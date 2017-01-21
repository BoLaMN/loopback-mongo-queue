var EventEmitter, async, loopback;

loopback = require('loopback');

async = require('async');

EventEmitter = require('events').EventEmitter;

module.exports = function(Worker) {
  Worker.mixin(EventEmitter);
  Worker.afterInitialize = function() {
    var Queue;
    Queue = loopback.getModel('Queue');
    if (this.queues === '*') {
      this.universal = true;
      this.queues = new Queue({
        name: '*',
        universal: true
      });
    }
    if (!Array.isArray(this.queues)) {
      this.queues = [this.queues];
    }
    return this.queues = this.queues.map(function(name) {
      var queue;
      if (typeof name === 'string') {
        queue = new Queue({
          name: name
        });
      }
      return queue;
    });
  };
  Worker.prototype.register = function(callbacks) {
    var name, results1;
    results1 = [];
    for (name in callbacks) {
      results1.push(this.callbacks[name] = callbacks[name]);
    }
    return results1;
  };
  Worker.prototype.strategies = function(strategies) {
    var name, results1;
    results1 = [];
    for (name in strategies) {
      results1.push(this.strategies[name] = strategies[name]);
    }
    return results1;
  };
  Worker.prototype.start = function() {
    if (this.queues.length === 0) {
      return setTimeout(this.start.bind(this), this.interval);
    }
    this.working = true;
    return this.poll();
  };
  Worker.prototype.stop = function(callback) {
    if (callback == null) {
      callback = function() {};
    }
    if (!this.working) {
      callback();
    }
    this.working = false;
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
      return callback();
    }
    return this.once('stopped', callback);
  };
  Worker.prototype.addQueue = function(queue) {
    if (!this.universal) {
      return this.queues.push(queue);
    }
  };
  Worker.prototype._poll = function(err, task) {
    if (err) {
      return this.emit('error', err);
    }
    if (task) {
      this.empty = 0;
      this.emit('dequeued', task);
      this.work(task);
      return;
    }
    this.emit('empty');
    if (this.empty < this.queues.length) {
      this.empty++;
    }
    if (this.empty === this.queues.length) {
      return this.pollTimeout = setTimeout((function(_this) {
        return function() {
          _this.pollTimeout = null;
          return _this.poll();
        };
      })(this), this.interval);
    } else {
      return this.poll();
    }
  };
  Worker.prototype.poll = function() {
    if (!this.working) {
      return this.emit('stopped');
    }
    return this.dequeue(this._poll.bind(this));
  };
  Worker.prototype.dequeue = function(callback) {
    var data, queue;
    queue = this.queues.shift();
    this.queues.push(queue);
    data = {
      minPriority: this.minPriority,
      callbacks: this.callbacks
    };
    return queue.dequeue(data, callback);
  };
  Worker.prototype.done = function(task, timer, err, result) {
    var finish;
    clearTimeout(timer);
    this.emit('done', task);
    finish = function(type, err) {
      if (err) {
        return this.emit('error', err);
      }
      this.emit(type, task);
      return this.poll();
    };
    if (err) {
      return task.error(err, finish.bind(this, 'failed'));
    } else {
      return task.complete(result, finish.bind(this, 'complete'));
    }
  };
  Worker.prototype.work = function(task) {
    var done, finished, timer;
    finished = false;
    done = (function(_this) {
      return function(err, results) {
        return _this.done(task, timer, err, results);
      };
    })(this);
    if (task.timeout) {
      timer = setTimeout(function() {
        return done(new Error('timeout'));
      }, task.timeout);
    }
    return this.process(task, done);
  };
  return Worker.prototype.process = function(task, callback) {
    var Profiler, callbacks, profiler, stop;
    Profiler = loopback.getModel('Profiler');
    profiler = new Profiler({
      task: task
    });
    callbacks = this.callbacks;
    stop = false;
    async.eachSeries(task.chain, function(item, done) {
      var bound, context, finish, func, logger;
      if (stop) {
        return done(null, task.results);
      }
      func = callbacks[item];
      if (!func) {
        return done(new Error('No callback registered for `' + item + '`'));
      }
      logger = profiler.start(item);
      finish = function(err, results) {
        if (results) {
          task.results = results;
        }
        return profiler.end(item, function() {
          return done(err, task.results);
        });
      };
      context = {
        done: function(err, results) {
          stop = true;
          return finish(err, results);
        },
        log: logger
      };
      bound = func.bind(context);
      return bound(task, finish);
    }, function(err) {
      return callback(err, task.results);
    });
  };
};
