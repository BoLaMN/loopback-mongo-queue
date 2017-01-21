var loopback;

loopback = require('loopback');

module.exports = function(Profiler) {
  Profiler.prototype.start = function(name) {
    var Step;
    Step = loopback.getModel('Step');
    this.log[name] = new Step();
    this.steps.push(name);
    return this.log[name];
  };
  Profiler.prototype.end = function(name, callback) {
    if (!this.log[name]) {
      return console.error('Stage ', name, ' has not started yet');
    }
    this.log[name].end();
    this.steps.splice(this.steps.indexOf(name), 1);
    return this.task.log(name, this.log[name], callback);
  };
  Profiler.prototype.endAll = function() {
    return this.steps.forEach((function(_this) {
      return function(step) {
        return _this.end(step);
      };
    })(this));
  };
  Profiler.prototype.flush = function() {
    return Object.keys(this.log).reduce((function(_this) {
      return function(memo, key) {
        memo[key] = _this.log[key].toObject();
        return memo;
      };
    })(this), {});
  };
};
