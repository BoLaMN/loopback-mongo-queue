var loopback,
  slice = [].slice;

loopback = require('loopback');

module.exports = function(Step) {
  var Log;
  Log = loopback.getModel('Log');
  Step.prototype.end = function() {
    return this.ended = Date.now();
  };
  Step.prototype.info = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    this.logs.push(new Log({
      type: 'info',
      args: args
    }));
    return this;
  };
  Step.prototype.debug = function() {
    var args;
    args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
    this.logs.push(new Log({
      type: 'debug',
      args: args
    }));
    return this;
  };
  return Step.prototype.error = function(error) {
    if (error == null) {
      error = {};
    }
    if (!error instanceof Error) {
      return console.error(error, 'is not instance of error');
    }
    this.logs.push(new Log({
      type: 'error',
      args: [error.message, error.stack]
    }));
    return this;
  };
};
