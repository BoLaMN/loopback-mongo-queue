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

  Task::update = (data, callback) ->
    query =
      id: @id or @_id

    update =
      $set: data

    Task.update query, update, callback

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
      events: @events
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
      events: @events
    , callback

  Task::enqueue = (callback) ->

    @status = Task.QUEUED
    @enqueued = new Date

    if @delay is undefined
      @delay = new Date

    if @priority is undefined
      @priority = 0

    Task.create this, callback
