loopback = require 'loopback'

module.exports = (Queue) ->

  Queue::get = (id, callback) ->
    query =
      id: id

    if not @universal
      query.queue = @name

    Model = loopback.getModel @model

    Model.findOne query, (err, data) ->
      if err
        return callback(err)

      callback null, new Task data

  Queue::enqueue = (chain, params, options, callback) ->
    if !callback and typeof options == 'function'
      callback = options
      options = {}

    if not @universal
      options.queue = @name

    Task = loopback.getModel 'Task'

    data = new Task
      chain: chain
      params: params
      queue: options.queue or @name
      attempts: options.attempts
      timeout: options.timeout
      delay: options.delay
      priority: options.priority

    Task.create data, callback

  Queue::dequeue = (options, callback) ->
    if callback == undefined
      callback = options
      options = {}

    if not @universal
      options.queue = @name

    Task = loopback.getModel 'Task'

    Task.dequeue options, callback
