var async, loopback;

loopback = require('loopback');

async = require('async');

module.exports = function(Task) {
  Task.QUEUED = 'queued';
  Task.DEQUEUED = 'dequeued';
  Task.COMPLETE = 'complete';
  Task.FAILED = 'failed';
  Task.CANCELLED = 'cancelled';
  Task.setter.chain = function(chain) {
    if (typeof chain === 'string') {
      chain = [chain];
    }
    return this.$chain = chain;
  };
  Task.setter.timeout = function(timeout) {
    if (timeout === void 0) {
      return void 0;
    }
    return this.$timeout = parseInt(timeout, 10);
  };
  Task.dequeue = function(options, callback) {
    var connector, opts, query, sort, update;
    if (callback === void 0) {
      callback = options;
      options = {};
    }
    query = {
      status: Task.QUEUED,
      delay: {
        $lte: new Date
      }
    };
    if (options.queue) {
      query.queue = options.queue;
    }
    if (options.chain) {
      query.chain = {
        $all: options.chain
      };
    }
    if (options.minPriority !== void 0) {
      query.priority = {
        $gte: options.minPriority
      };
    }
    sort = {
      priority: -1,
      _id: 1
    };
    update = {
      $set: {
        status: Task.DEQUEUED,
        dequeued: new Date
      }
    };
    opts = {
      "new": true
    };
    connector = this.getConnector();
    return connector.connect(function() {
      var collection;
      collection = connector.collection(Task.modelName);
      return collection.findAndModify(query, sort, update, opts, function(err, doc) {
        var id, item, task;
        if (err || !doc.value) {
          return callback(err);
        }
        item = doc.value;
        id = item._id;
        delete item._id;
        task = new Task(item);
        task.setId(id);
        return callback(null, task);
      });
    });
  };
  Task.prototype.update = function(data, callback) {
    var query, update;
    query = {
      id: this.id
    };
    update = {
      $set: data
    };
    if (!data.events) {
      this.setAttributes(data);
    }
    return Task.update(query, update, callback);
  };
  Task.prototype.log = function(name, log, callback) {
    var base, name1, update;
    update = {};
    update['events.' + this.count + '.' + name] = log.toObject();
    if (this.events == null) {
      this.events = [];
    }
    if ((base = this.events)[name1 = this.count] == null) {
      base[name1] = {};
    }
    this.events[this.count][name] = log;
    return this.update(update, callback);
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
      result: result
    }, callback);
  };
  Task.prototype.errored = function(err, callback) {
    var wait;
    if (this.attempts) {
      this.remaining = this.remaining - 1;
    }
    if (this.attempts !== this.count || this.remaining > 0) {
      wait = 50 * Math.pow(2, this.count);
      this.delay = new Date(new Date().getTime() + wait);
      this.count = this.count + 1;
      return this.reenqueue(callback);
    } else {
      return this.fail(err, callback);
    }
  };
  Task.prototype.reenqueue = function(callback) {
    return this.update({
      status: Task.QUEUED,
      enqueued: new Date,
      remaining: this.remaining,
      count: this.count,
      delay: this.delay
    }, callback);
  };
  Task.prototype.fail = function(err, callback) {
    return this.update({
      status: Task.FAILED,
      ended: new Date,
      error: err.message,
      stack: err.stack
    }, callback);
  };
  return Task.prototype.process = function(callbacks, callback) {
    var Profiler, Worker, ccallbacks, profiler, stop, task;
    if (!callback && typeof callbacks === 'function') {
      callback = callbacks;
      ccallbacks = null;
    }
    task = this;
    Profiler = loopback.getModel('Profiler');
    Worker = loopback.getModel('Worker');
    profiler = new Profiler({
      task: task
    });
    callbacks = callbacks || Worker.callbacks;
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
