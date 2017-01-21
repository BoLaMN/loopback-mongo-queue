loopback = require 'loopback'

module.exports = (Profiler) ->

  Profiler::start = (name) ->
    if @log[name]
      console.warn 'Stage name ', name, ' is already in use'

    Step = loopback.getModel 'Step'

    @log[name] = new Step()

    @steps.push name

    @log[name]

  Profiler::end = (name, callback) ->
    if not @log[name]
      return console.error 'Stage ', name, ' has not started yet'

    @log[name].end()

    @steps.splice @steps.indexOf(name), 1

    @task.log name, @log[name], callback

  Profiler::endAll = ->
    @steps.forEach (step) =>
      @end step

  Profiler::flush = ->
    Object.keys(@log).reduce (memo, key) =>
      memo[key] = @log[key].toObject()
      memo
    , {}