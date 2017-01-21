module.exports = (Task) ->

  Task.QUEUED = 'queued'
  Task.DEQUEUED = 'dequeued'
  Task.COMPLETE = 'complete'
  Task.FAILED = 'failed'
  Task.CANCELLED = 'cancelled'

  Task.strategies =
    linear: (attempts) ->
      attempts.delay

    exponential: (attempts) ->
      attempts.delay * (attempts.count - (attempts.remaining))

  Task.setter.chain = (chain) ->
    if typeof chain is 'string'
      chain = [ chain ]

    @$chain = chain

  Task.setter.timeout = (timeout) ->
    if timeout is undefined
      return undefined

    @$timeout = parseInt timeout, 10

  Task.setter.attempts = (attempts) ->
    if attempts is undefined
      return undefined

    if typeof attempts != 'object'
      throw new Error 'attempts must be an object'

    result = count: parseInt attempts.count, 10

    if attempts.delay isnt undefined
      result.delay = parseInt attempts.delay, 10
      result.strategy = attempts.strategy

    @$attempts = result

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
    update['events.' + name] = log.toObject()

    @events ?= {}
    @events[name] = log

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

  Task::error = (err, callback) ->
    remaining = 0
    strategies = Task.strategies

    if @attempts
      remaining = @attempts.remaining = (@attempts.remaining or @attempts.count) - 1

    if remaining > 0
      strategy = strategies[@attempts.strategy or 'linear']

      if not strategy
        console.error 'No such retry strategy: `' + @attempts.strategy + '`'
        console.error 'Using linear strategy'

      if @attempts.delay isnt undefined
        wait = strategy(@attempts)
      else
        wait = 0

      @delay wait, callback
    else
      @fail err, callback

  Task::fail = (err, callback) ->

    @update
      status: Task.FAILED
      ended: new Date
      error: err.message
      stack: err.stack
    , callback
