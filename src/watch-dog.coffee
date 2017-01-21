loopback = require 'loopback'

{ EventEmitter } = require 'events'

module.exports = (WatchDog) ->

  WatchDog.mixin EventEmitter

  WatchDog::_getTimedOutJob = (callback) ->

    query =
      status: 'dequeued'
      queue: @queue.name
      timeoutAt:
        lt: new Date (new Date).getTime() + @gracePeriod

    sort =
      timeoutAt: 1

    options =
      new: true

    update =
      $set:
        status: 'timedout'

    cb = callback.bind this

    Model = loopback.getModel @queue.model

    Model.update query, sort, update, options, (err, doc) ->
      cb err, if doc then new Model(doc) else doc

  WatchDog::cleanup = ->
    @_getTimedOutJob (err, job) ->
      if @stopped
        return

      if err
        @emit err
        @scheduleTimer()
      else if job
        error = new Error 'Timed out'

        job.fail error, (err, job) =>
          if err
            @scheduleTimer()
            return @emit(err)

          @emit 'timedout', job

          if not @stopped
            @cleanup()
      else
        @scheduleTimer()

  WatchDog::scheduleTimer = (interval) ->
    @timer = setTimeout @cleanup, interval or @interval

  WatchDog::start = ->
    @stopped = false
    @scheduleTimer Math.floor Math.random() * @interval

  WatchDog::stop = ->
    @stopped = true
    clearTimeout @timer
