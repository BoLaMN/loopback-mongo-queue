loopback = require 'loopback'

module.exports = (Workflow) ->

  Workflow::get = (id, callback) ->
    query =
      id: id

    if not @universal
      query.Workflow = @name

    Task = loopback.getModel 'Task'

    Task.findOne query, (err, data) ->
      if err
        return callback err

      callback null, new Task data

  Workflow::enqueue = (params, options, callback) ->
    if !callback and typeof options is 'function'
      callback = options
      options = {}

    Task = loopback.getModel 'Task'

    data = new Task
      chain: @chain
      params: params
      queue: options.queue or @queue
      attempts: options.attempts
      timeout: options.timeout
      delay: options.delay
      priority: options.priority

    Task.create data, callback

  Workflow::dequeue = (options, callback) ->
    if callback is undefined
      callback = options
      options = {}

    if not @universal
      options.queue = @queue

    options.chain = @chain

    Task = loopback.getModel 'Task'

    Task.dequeue options, callback
