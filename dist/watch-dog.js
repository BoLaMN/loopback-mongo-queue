var EventEmitter, loopback;

loopback = require('loopback');

EventEmitter = require('events').EventEmitter;

module.exports = function(WatchDog) {
  WatchDog.mixin(EventEmitter);
  WatchDog.prototype._getTimedOutJob = function(callback) {
    var Task, cb, options, query, sort, update;
    query = {
      status: 'dequeued',
      queue: this.queue.name,
      timeoutAt: {
        lt: new Date((new Date).getTime() + this.gracePeriod)
      }
    };
    sort = {
      timeoutAt: 1
    };
    options = {
      "new": true
    };
    update = {
      $set: {
        status: 'timedout'
      }
    };
    cb = callback.bind(this);
    Task = loopback.getModel('Task');
    return Task.update(query, sort, update, options, function(err, doc) {
      return cb(err, doc ? new Model(doc) : doc);
    });
  };
  WatchDog.prototype.cleanup = function() {
    return this._getTimedOutJob(function(err, job) {
      var error;
      if (this.stopped) {
        return;
      }
      if (err) {
        this.emit(err);
        return this.scheduleTimer();
      } else if (job) {
        error = new Error('Timed out');
        return job.fail(error, (function(_this) {
          return function(err, job) {
            if (err) {
              _this.scheduleTimer();
              return _this.emit(err);
            }
            _this.emit('timedout', job);
            if (!_this.stopped) {
              return _this.cleanup();
            }
          };
        })(this));
      } else {
        return this.scheduleTimer();
      }
    });
  };
  WatchDog.prototype.scheduleTimer = function(interval) {
    return this.timer = setTimeout(this.cleanup, interval || this.interval);
  };
  WatchDog.prototype.start = function() {
    this.stopped = false;
    return this.scheduleTimer(Math.floor(Math.random() * this.interval));
  };
  return WatchDog.prototype.stop = function() {
    this.stopped = true;
    return clearTimeout(this.timer);
  };
};
