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
  Task.setter.attempts = function(attempts) {
    var result;
    if (attempts === void 0) {
      return void 0;
    }
    if (typeof attempts !== 'object') {
      throw new Error('attempts must be an object');
    }
    result = {
      count: parseInt(attempts.count, 10)
    };
    if (attempts.delay !== void 0) {
      result.delay = parseInt(attempts.delay, 10);
      result.strategy = attempts.strategy;
    }
    return this.$attempts = result;
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
    this.setAttributes(data);
    return Task.update(query, update, callback);
  };
  Task.prototype.log = function(name, log, callback) {
    var update;
    update = {
      events: {}
    };
    update.events[name] = log.toObject();
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
  return Task.prototype.fail = function(err, callback) {
    return this.update({
      status: Task.FAILED,
      ended: new Date,
      error: err.message,
      stack: err.stack
    }, callback);
  };
};
