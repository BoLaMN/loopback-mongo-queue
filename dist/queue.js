var loopback;

loopback = require('loopback');

module.exports = function(Queue) {
  var parseAttempts, parseTimeout;
  parseTimeout = function(timeout) {
    if (timeout === void 0) {
      return void 0;
    }
    return parseInt(timeout, 10);
  };
  parseAttempts = function(attempts) {
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
    return result;
  };
  Queue.prototype.get = function(id, callback) {
    var Model, Task, query;
    query = {
      id: id
    };
    if (!this.universal) {
      query.queue = this.name;
    }
    Model = loopback.getModel(this.model);
    Task = loopback.getModel('Task');
    return Model.findOne(query, function(err, data) {
      if (err) {
        return callback(err);
      }
      return callback(null, new Task(data));
    });
  };
  Queue.prototype.enqueue = function(chain, params, options, callback) {
    var Task, data, task;
    if (!callback && typeof options === 'function') {
      callback = options;
      options = {};
    }
    Task = loopback.getModel('Task');
    if (typeof chain === 'string') {
      chain = [chain];
    }
    data = {
      chain: chain,
      params: params,
      queue: this.name,
      attempts: parseAttempts(options.attempts),
      timeout: parseTimeout(options.timeout),
      delay: options.delay,
      priority: options.priority
    };
    task = new Task(data);
    return task.enqueue(callback);
  };
  return Queue.prototype.dequeue = function(options, callback) {
    var Task, callback_names, connector, query, sort, update;
    if (callback === void 0) {
      callback = options;
      options = {};
    }
    Task = loopback.getModel('Task');
    query = {
      status: Task.QUEUED,
      delay: {
        $lte: new Date
      }
    };
    if (!this.universal) {
      query.queue = this.name;
    }
    if (options.minPriority !== void 0) {
      query.priority = {
        $gte: options.minPriority
      };
    }
    if (options.callbacks !== void 0) {
      callback_names = Object.keys(options.callbacks);
      query.chain = {
        $in: callback_names
      };
    }
    sort = {
      priority: -1,
      id: 1
    };
    update = {
      $set: {
        status: Task.DEQUEUED,
        dequeued: new Date
      }
    };
    connector = this.getConnector();
    return connector.connect((function(_this) {
      return function() {
        var collection;
        collection = connector.collection(_this.model);
        return collection.findAndModify(query, sort, update, {
          "new": true
        }, function(err, doc) {
          if (err || !doc.value) {
            return callback(err);
          }
          return callback(null, new Task(doc.value));
        });
      };
    })(this));
  };
};
