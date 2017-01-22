var EventEmitter, loopback;

loopback = require('loopback');

EventEmitter = require('events').EventEmitter;

module.exports = function(Worker) {
  Worker.mixin(EventEmitter);
  Worker.callbacks = {};
  Worker.remove = function(id) {
    var handler;
    handler = this.callbacks[id];
    if (!handler) {
      return null;
    }
    delete this.callbacks[id];
    return handler;
  };
  Worker.find = function(id) {
    return this.callbacks[id] || null;
  };
  Worker.findOrAdd = function(id, handler) {
    handler = this.find(id);
    if (handler) {
      return handler;
    }
    return this.callbacks[id] = handler;
  };
  Worker.getHandlerNames = function() {
    return Object.keys(this.callbacks);
  };
  Worker.create = function(handlers) {
    return Object.keys(handlers).forEach((function(_this) {
      return function(handlerName) {
        if (_this.callbacks[handlerName]) {
          return new Error(handlerName + ' already registered');
        }
        return _this.callbacks[handlerName] = handlers[handlerName];
      };
    })(this));
  };
  Worker.afterInitialize = function() {
    var Queue;
    this.callbacks = Worker.callbacks;
    Queue = loopback.getModel('Queue');
    if (!this.queues) {
      this.universal = true;
      this.queues = [
        new Queue({
          name: '*',
          universal: true
        })
      ];
      return;
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
    console.error(err);
    if (err) {
      return task.errored(err, finish.bind(this, 'failed'));
    } else {
      result = (result != null ? typeof result.toObject === "function" ? result.toObject() : void 0 : void 0) || result;
      return task.complete(result, finish.bind(this, 'complete'));
    }
  };
  Worker.prototype.work = function(task) {
    var done, finished, timer;
    finished = false;
    done = (function(_this) {
      return function(err, results) {
        if (finished) {
          return;
        }
        finished = true;
        return _this.done(task, timer, err, results);
      };
    })(this);
    if (task.timeout) {
      timer = setTimeout(function() {
        return done(new Error('timeout'));
      }, task.timeout);
    }
    return task.process(this.callbacks, done);
  };
  process.nextTick(function() {
    var worker;
    worker = new Worker();
    return worker.start();
  });
};
