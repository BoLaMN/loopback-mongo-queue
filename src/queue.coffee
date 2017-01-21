loopback = require 'loopback'

module.exports = (Queue) ->

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

  Queue::get = (id, callback) ->
    query =
      id: id

    if not @universal
      query.queue = @name

    Model = loopback.getModel @model
    Task = loopback.getModel 'Task'

    Model.findOne query, (err, data) ->
      if err
        return callback(err)

      callback null, new Task data

  Queue::enqueue = (chain, params, options, callback) ->
    if !callback and typeof options == 'function'
      callback = options
      options = {}

    Task = loopback.getModel 'Task'

    if typeof chain is 'string'
      chain = [ chain ]

    data =
      chain: chain
      params: params
      queue: @name
      attempts: parseAttempts(options.attempts)
      timeout: parseTimeout(options.timeout)
      delay: options.delay
      priority: options.priority

    task = new Task data

    task.enqueue callback

  Queue::dequeue = (options, callback) ->
    if callback == undefined
      callback = options
      options = {}

    Task = loopback.getModel 'Task'

    query =
      status: Task.QUEUED
      delay:
        $lte: new Date

    if not @universal
      query.queue = @name

    if options.minPriority != undefined
      query.priority =
        $gte: options.minPriority

    if options.callbacks != undefined
      callback_names = Object.keys(options.callbacks)

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

    connector.connect =>
      collection = connector.collection @model

      collection.findAndModify query, sort, update, { new: true }, (err, doc) ->
        if err or not doc.value
          return callback err

        callback null, new Task doc.value
