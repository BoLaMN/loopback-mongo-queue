module.exports = (Task) ->

  parseTimeout = (timeout) ->
    if timeout == undefined
      return undefined

    parseInt timeout, 10

  parseAttempts = (attempts) ->
    if attempts == undefined
      return undefined

    if typeof attempts != 'object'
      throw new Error('attempts must be an object')

    result = count: parseInt(attempts.count, 10)

    if attempts.delay isnt undefined
      result.delay = parseInt(attempts.delay, 10)
      result.strategy = attempts.strategy

    result

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

  Task.enqueue = (chain, params, options, callback) ->
    if typeof chain is 'string'
      chain = [ chain ]

    data =
      chain: chain
      params: params
      queue: options.queue or @queue
      attempts: parseAttempts options.attempts
      timeout: parseTimeout options.timeout
      delay: options.delay
      priority: options.priority

    task = new Task data

    task.enqueue callback

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

    if options.minPriority != undefined
      query.priority =
        $gte: options.minPriority

    if options.callbacks != undefined
      callback_names = Object.keys options.callbacks

      query.chain =
        $in: callback_names

    sort =
      priority: -1
      id: 1

    update =
      $set:
        status: Task.DEQUEUED
        dequeued: new Date

    connector = @getConnector()

    connector.connect ->
      collection = connector.collection Task.modelName

      collection.findAndModify query, sort, update, { new: true }, (err, doc) ->
        if err or not doc.value
          return callback err

        callback null, new Task doc.value

  Task::update = (data, callback) ->
    query =
      id: @id or @_id

    update =
      $set: data

    Task.update query, update, callback

  Task::log = (name, log, callback) ->

    update =
      events: {}

    update.events[name] = log.toObject()

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

  Task::enqueue = (callback) ->

    @status = Task.QUEUED
    @enqueued = new Date

    if @delay is undefined
      @delay = new Date

    if @priority is undefined
      @priority = 0

    Task.create this, callback
