loopback = require 'loopback'

module.exports = (Step) ->

  Log = loopback.getModel 'Log'

  Step::end = ->
    @ended = Date.now()

  Step::info = (args...) ->
    @logs.push new Log
      type: 'info'
      args: args

    this

  Step::debug = (args...) ->
    @logs.push new Log
      type: 'debug'
      args: args

    this

  Step::error = (error = {}) ->
    if not error instanceof Error
      return console.error error, 'is not instance of error'

    @logs.push new Log
      type: 'error'
      args: [ error.message, error.stack ]

    this
