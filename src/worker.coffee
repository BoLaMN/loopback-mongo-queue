loopback = require 'loopback'
async = require 'async'

{ EventEmitter } = require 'events'

module.exports = (Worker) ->

  Worker.mixin EventEmitter

  Worker.afterInitialize = ->

    Queue = loopback.getModel 'Queue'

    if @queues is '*'
      @universal = true

      @queues = new Queue
        name: '*'
        universal: true

    if not Array.isArray @queues
      @queues = [ @queues ]

    @queues = @queues.map (name) ->
      if typeof name is 'string'
        queue = new Queue
          name: name

      queue

  Worker::register = (callbacks) ->
    for name of callbacks
      @callbacks[name] = callbacks[name]

  Worker::strategies = (strategies) ->
    for name of strategies
      @strategies[name] = strategies[name]

  Worker::start = ->
    if @queues.length == 0
      return setTimeout @start.bind(this), @interval

    @working = true
    @poll()

  Worker::stop = (callback = ->) ->
    if not @working
      callback()

    @working = false

    if @pollTimeout
      clearTimeout @pollTimeout
      @pollTimeout = null

      return callback()

    @once 'stopped', callback

  Worker::addQueue = (queue) ->
    if not @universal
      @queues.push queue

  Worker::_poll = (err, task) ->
    if err
      return @emit 'error', err

    if task
      @empty = 0
      @emit 'dequeued', task
      @work task
      return

    @emit 'empty'

    if @empty < @queues.length
      @empty++

    if @empty == @queues.length
      @pollTimeout = setTimeout =>
        @pollTimeout = null
        @poll()
      , @interval
    else
      @poll()

  Worker::poll = ->
    if not @working
      return @emit 'stopped'

    @dequeue @_poll.bind(this)

  Worker::dequeue = (callback) ->
    queue = @queues.shift()

    @queues.push queue

    data =
      minPriority: @minPriority
      callbacks: @callbacks

    queue.dequeue data, callback

  Worker::done = (task, timer, err, result) ->
    clearTimeout timer

    @emit 'done', task

    finish = (type, err) ->
      if err
        return @emit 'error', err

      @emit type, task
      @poll()

    if err
      task.error err, finish.bind(this, 'failed')
    else
      task.complete result, finish.bind(this, 'complete')

  Worker::work = (task) ->
    finished = false

    done = (err, results) =>
      @done task, timer, err, results

    if task.timeout
      timer = setTimeout ->
        done new Error 'timeout'
      , task.timeout

    @process task, done

  Worker::process = (task, callback) ->
    Profiler = loopback.getModel 'Profiler'

    profiler = new Profiler
      task: task

    callbacks = @callbacks

    stop = false

    async.eachSeries task.chain, (item, done) ->
      if stop
        return done null, task.results

      func = callbacks[item]

      if not func
        return done new Error 'No callback registered for `' + item + '`'

      logger = profiler.start item

      finish = (err, results) ->
        if results
          task.results = results

        profiler.end item, ->
          done err, task.results

      context =
        done: (err, results) ->
          stop = true
          finish err, results
        log: logger

      bound = func.bind context

      bound task, finish
    , (err) ->
      callback err, task.results

    return
