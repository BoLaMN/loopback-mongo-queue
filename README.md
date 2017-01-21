# loopback-mongo-queue
loopback mongo based queue

* model-config

```
Queue:
  dataSource: "mongo"
  public: false

Workflow:
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

  { Worker, Queue, Workflow, Task } = app.models

  fns =
    uppercase: (task, callback) ->
      { params } = task

      @log.info 'setting ' + params.text + ' to upper case'
      @log.error new Error 'testing error'

      setTimeout ->
        uppercase = params.text.toUpperCase()
        callback null, uppercase
      , 3000

    prepend: (task, callback) ->
      { results } = task

      @log.info 'add foo to ' + results
      @log.error new Error 'testing error'

      text = 'foo ' + results

      callback null, text

  worker = new Worker()
  worker.register fns

  # registers global functions

  Worker.create fns

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

  enqueued = (err, job) ->
    if err
      throw err

    console.log 'Enqueued:', job

  Task.create
    chain: 'uppercase'
    params:
      text: 'bar'
  , enqueued

  queue = new Queue
    name: 'foo'

  queue.enqueue 'uppercase', { text: 'bar' }, enqueued

  workflow = new Workflow
    name: 'my workflow'
    chain: [ 'uppercase', 'prepend' ]

  workflow.enqueue { text: 'bar' }, enqueued

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
            "error.message", "error.stack"
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
