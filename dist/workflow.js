var loopback;

loopback = require('loopback');

module.exports = function(Workflow) {
  Workflow.prototype.get = function(id, callback) {
    var Task, query;
    query = {
      id: id
    };
    if (!this.universal) {
      query.Workflow = this.name;
    }
    Task = loopback.getModel('Task');
    return Task.findOne(query, function(err, data) {
      if (err) {
        return callback(err);
      }
      return callback(null, new Task(data));
    });
  };
  Workflow.prototype.enqueue = function(params, options, callback) {
    var Task, data;
    if (!callback && typeof options === 'function') {
      callback = options;
      options = {};
    }
    Task = loopback.getModel('Task');
    data = new Task({
      chain: this.chain,
      params: params,
      queue: options.queue || this.queue,
      attempts: options.attempts,
      timeout: options.timeout,
      delay: options.delay,
      priority: options.priority
    });
    return Task.create(data, callback);
  };
  return Workflow.prototype.dequeue = function(options, callback) {
    var Task;
    if (callback === void 0) {
      callback = options;
      options = {};
    }
    if (!this.universal) {
      options.queue = this.queue;
    }
    options.chain = this.chain;
    Task = loopback.getModel('Task');
    return Task.dequeue(options, callback);
  };
};
