var loopback;

loopback = require('loopback');

module.exports = function(Queue) {
  Queue.prototype.get = function(id, callback) {
    var Model, query;
    query = {
      id: id
    };
    if (!this.universal) {
      query.queue = this.name;
    }
    Model = loopback.getModel(this.model);
    return Model.findOne(query, function(err, data) {
      if (err) {
        return callback(err);
      }
      return callback(null, new Task(data));
    });
  };
  Queue.prototype.enqueue = function(chain, params, options, callback) {
    var Task;
    if (!callback && typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (!this.universal) {
      options.queue = this.name;
    }
    Task = loopback.getModel('Task');
    return Task.enqueue(chain, params, options, callback);
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
