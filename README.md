# loopback-mongo-queue
loopback mongo based queue

* model-config

```
Queue:
  dataSource: "mongo"
  public: false

Task:
  dataSource: "mongo"

Worker:
  dataSource: false
  public: false

Log:
  dataSource: false
  public: false

Profiler:
  dataSource: false
  public: false

Step:
  dataSource: false
  public: false
```

* example 

```

module.exports = (app) ->

  { Worker, Queue } = app.models

  worker = new Worker
    queues: [ 'foo' ]

  worker.register
    uppercase: (task, callback) ->
      { params } = task

      @log.info 'setting ' + params.text + ' to upper case'
      @log.error new Error 'testing error'

      uppercase = params.text.toUpperCase()

      callback null, uppercase

  worker.on 'dequeued', (data) ->
    console.log 'Dequeued:'
    console.log data

  worker.on 'failed', (data) ->
    console.log 'Failed:'
    console.log data

  worker.on 'complete', (data) ->
    console.log 'Complete:'
    console.log data

  worker.on 'error', (err) ->
    console.log 'Error:'
    console.log err

    worker.stop()

  worker.start()

  queue = new Queue
    name: 'foo'

  queue.enqueue 'uppercase', { text: 'bar' }, (err, job) ->
    if err
      throw err

    console.log 'Enqueued:', job

    return
```

* after task complete model data 

```
{
  "chain": [
    "uppercase"
  ],
  "events": {
    "uppercase": {
      "started": "2017-01-21T10:49:40.442Z",
      "ended": "2017-01-21T10:49:43.446Z",
      "logs": [
        {
          "args": [
            "setting bar to upper case"
          ],
          "time": "2017-01-21T10:49:40.444Z",
          "type": "info"
        },
        {
          "args": [
            {}
          ],
          "time": "2017-01-21T10:49:40.444Z",
          "type": "error"
        }
      ]
    }
  },
  "status": "complete",
  "params": {
    "text": "bar"
  },
  "queue": "foo",
  "count": 0,
  "delay": "2017-01-21T10:49:34.943Z",
  "priority": 0,
  "ended": "2017-01-21T10:49:43.447Z",
  "enqueued": "2017-01-21T10:49:34.943Z",
  "result": "BAR",
  "id": "58833cbff73b6ed1ec9f8f91",
  "dequeued": "2017-01-21T10:49:40.434Z"
}
```
