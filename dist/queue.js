var loopback;

loopback = require('loopback');

module.exports = function(Queue) {
  Queue.prototype.get = function(id, callback) {
    var Task, query;
    query = {
      id: id
    };
    if (!this.universal) {
      query.queue = this.name;
    }
    Task = loopback.getModel('Task');
    return Task.findOne(query, function(err, data) {
      if (err) {
        return callback(err);
      }
      return callback(null, new Task(data));
    });
  };
  Queue.prototype.enqueue = function(chain, params, options, callback) {
    var Task, data;
    if (!callback && typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (!this.universal) {
      options.queue = this.name;
    }
    Task = loopback.getModel('Task');
    data = new Task({
      chain: chain,
      params: params,
      queue: options.queue || this.name,
      attempts: options.attempts,
      timeout: options.timeout,
      delay: options.delay,
      priority: options.priority
    });
    return Task.create(data, callback);
  };
  return Queue.prototype.dequeue = function(options, callback) {
    var Task;
    if (callback === void 0) {
      callback = options;
      options = {};
    }
    if (!this.universal) {
      options.queue = this.name;
    }
    Task = loopback.getModel('Task');
    return Task.dequeue(options, callback);
  };
};
