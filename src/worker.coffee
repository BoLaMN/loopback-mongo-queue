loopback = require 'loopback'

{ EventEmitter } = require 'events'

module.exports = (Worker) ->

  Worker.mixin EventEmitter

  Worker.callbacks = {}

  Worker.remove = (id) ->
    handler = @callbacks[id]

    if not handler
      return null

    delete @callbacks[id]

    handler

  Worker.find = (id) ->
    @callbacks[id] or null

  Worker.findOrAdd = (id, handler) ->
    handler = @find id

    if handler
      return handler

    @callbacks[id] = handler

  Worker.getHandlerNames = ->
    Object.keys @callbacks

  Worker.create = (handlers) ->
    Object.keys(handlers).forEach (handlerName) =>
      if @callbacks[handlerName]
        return new Error handlerName + ' already registered'

      @callbacks[handlerName] = handlers[handlerName]

  Worker.afterInitialize = ->
    @callbacks = Worker.callbacks

    Queue = loopback.getModel 'Queue'

    if not @queues
      @universal = true

      @queues = [ new Queue
        name: '*'
        universal: true
      ]

      return

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

  Worker::start = ->
    if @queues.length is 0
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

    if @empty is @queues.length
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

    console.error err

    if err
      task.errored err, finish.bind(this, 'failed')
    else
      result = result?.toObject?() or result

      task.complete result, finish.bind(this, 'complete')

  Worker::work = (task) ->
    finished = false

    done = (err, results) =>
      return if finished

      finished = true

      @done task, timer, err, results

    if task.timeout
      timer = setTimeout ->
        done new Error 'timeout'
      , task.timeout

    task.process @callbacks, done


  process.nextTick ->
    worker = new Worker()

    worker.start()

  return
