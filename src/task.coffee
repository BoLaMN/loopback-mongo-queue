loopback = require 'loopback'
async    = require 'async'

module.exports = (Task) ->

  Task.QUEUED = 'queued'
  Task.DEQUEUED = 'dequeued'
  Task.COMPLETE = 'complete'
  Task.FAILED = 'failed'
  Task.CANCELLED = 'cancelled'

  Task.setter.chain = (chain) ->
    if typeof chain is 'string'
      chain = [ chain ]

    @$chain = chain

  Task.setter.timeout = (timeout) ->
    if timeout is undefined
      return undefined

    @$timeout = parseInt timeout, 10

  Task.dequeue = (options, callback) ->
    if callback == undefined
      callback = options
      options = {}

    query =
      status: Task.QUEUED
      delay:
        $lte: new Date

    if options.queue
      query.queue = options.queue

    if options.chain
      query.chain = $all: options.chain

    if options.minPriority != undefined
      query.priority =
        $gte: options.minPriority

    sort =
      priority: -1
      _id: 1

    update =
      $set:
        status: Task.DEQUEUED
        dequeued: new Date

    opts =
      new: true

    connector = @getConnector()

    connector.connect ->
      collection = connector.collection Task.modelName

      collection.findAndModify query, sort, update, opts, (err, doc) ->
        if err or not doc.value
          return callback err

        item = doc.value

        id = item._id
        delete item._id

        task = new Task item
        task.setId id

        callback null, task

  Task::update = (data, callback) ->
    query =
      id: @id

    update =
      $set: data

    if not data.events
      @setAttributes data

    Task.update query, update, callback

  Task::log = (name, log, callback) ->

    update = {}
    update['events.' + @count + '.' + name] = log.toObject()

    @events ?= []
    @events[@count] ?= {}
    @events[@count][name] = log

    @update update, callback

  Task::cancel = (callback) ->
    if @status isnt Task.QUEUED
      return callback new Error 'Only queued tasks may be cancelled'

    @update
      status: Task.CANCELLED
      ended:  new Date
    , callback

  Task::complete = (result, callback) ->

    @update
      status: Task.COMPLETE
      ended: new Date
      result: result
    , callback

  Task::errored = (err, callback) ->
    if @attempts
      @remaining = @remaining - 1

    if @attempts isnt @count or @remaining > 0
      wait = 50 * 2 ** @count

      @delay = new Date new Date().getTime() + wait
      @count = @count + 1

      @reenqueue callback
    else
      @fail err, callback

  Task::reenqueue = (callback) ->

    @update
      status: Task.QUEUED
      enqueued: new Date
      remaining: @remaining
      count: @count
      delay: @delay
    , callback

  Task::fail = (err, callback) ->

    @update
      status: Task.FAILED
      ended: new Date
      error: err.message
      stack: err.stack
    , callback

  Task::process = (callbacks, callback) ->
    if !callback and typeof callbacks is 'function'
      callback = callbacks
      ccallbacks = null

    task = this

    Profiler = loopback.getModel 'Profiler'
    Worker = loopback.getModel 'Worker'

    profiler = new Profiler
      task: task

    callbacks = callbacks or Worker.callbacks

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
