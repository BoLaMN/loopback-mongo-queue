module.exports = function(Task) {
  Task.QUEUED = 'queued';
  Task.DEQUEUED = 'dequeued';
  Task.COMPLETE = 'complete';
  Task.FAILED = 'failed';
  Task.CANCELLED = 'cancelled';
  Task.strategies = {
    linear: function(attempts) {
      return attempts.delay;
    },
    exponential: function(attempts) {
      return attempts.delay * (attempts.count - attempts.remaining);
    }
  };
  Task.prototype.update = function(data, callback) {
    var query, update;
    query = {
      id: this.id || this._id
    };
    update = {
      $set: data
    };
    return Task.update(query, update, callback);
  };
  Task.prototype.cancel = function(callback) {
    if (this.status !== Task.QUEUED) {
      return callback(new Error('Only queued tasks may be cancelled'));
    }
    return this.update({
      status: Task.CANCELLED,
      ended: new Date
    }, callback);
  };
  Task.prototype.complete = function(result, callback) {
    return this.update({
      status: Task.COMPLETE,
      ended: new Date,
      result: result,
      events: this.events
    }, callback);
  };
  Task.prototype.error = function(err, callback) {
    var remaining, strategies, strategy, wait;
    remaining = 0;
    strategies = Task.strategies;
    if (this.attempts) {
      remaining = this.attempts.remaining = (this.attempts.remaining || this.attempts.count) - 1;
    }
    if (remaining > 0) {
      strategy = strategies[this.attempts.strategy || 'linear'];
      if (!strategy) {
        console.error('No such retry strategy: `' + this.attempts.strategy + '`');
        console.error('Using linear strategy');
      }
      if (this.attempts.delay !== void 0) {
        wait = strategy(this.attempts);
      } else {
        wait = 0;
      }
      return this.delay(wait, callback);
    } else {
      return this.fail(err, callback);
    }
  };
  Task.prototype.fail = function(err, callback) {
    return this.update({
      status: Task.FAILED,
      ended: new Date,
      error: err.message,
      stack: err.stack,
      events: this.events
    }, callback);
  };
  return Task.prototype.enqueue = function(callback) {
    this.status = Task.QUEUED;
    this.enqueued = new Date;
    if (this.delay === void 0) {
      this.delay = new Date;
    }
    if (this.priority === void 0) {
      this.priority = 0;
    }
    return Task.create(this, callback);
  };
};
