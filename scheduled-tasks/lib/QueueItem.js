const EventEmitter = require("events");
const { v4: uuid } = require("uuid");

const Task = require("./Task");

const EVENT_EMITTER_KEY = Symbol();

/**
 * @typedef {Object} QueueItemOptions
 * @property {string} task - the Task ID
 */

class QueueItem {
  requestedForStart = false;
  requestedForStop = false;
  running = false;
  busy = false;

  /**
   * @param {QueueItemOptions} options
   */
  constructor({ task }) {
    const tasks = Task.getAll();
    const matchedTask = tasks.find(({ id }) => id === task);

    if (matchedTask) {
      this.task = matchedTask;

      this[EVENT_EMITTER_KEY] = new EventEmitter();

      // Listen on task events
      this.task.on("error", (error) => {
        console.log('task error fired', error);
        this[EVENT_EMITTER_KEY].emit("task-error", error)
      });
      this.task.on("exit", this.onTaskExit.bind(this));
      Task.on('start', this.onTaskStart.bind(this));

      // Add id
      this.id = uuid().replace(/-/g,'');
    } else {
      throw new Error(
        `Unable to create QueueItem. No matching task for id "${task}"`
      );
    }
  }

  /**
   * @param {string} taskID - the Task ID
   * @returns {QueueItem}
   */
  static create(taskID) {
    return new QueueItem({
      task: taskID,
    });
  }

  async start() {
    if ( this.busy ) {
      // Task might be busy starting or stopping
      return;
    }

    this.busy = true;
    await this.task.start(this.id);
  }

  async stop() {
    this.busy = true;
    this.requestedForStop = true;
    await this.task.stop();
  }

  onTaskStart(taskData) {
    const { parentQueueItem } = taskData;

    if (parentQueueItem === this.id) {
      this.running = true;
      this.requestedForStart = false;
      this[EVENT_EMITTER_KEY].emit("task-start");
      this.busy = false;
    }
  }

  onTaskExit(taskData) {
    const { parentQueueItem } = taskData;

    if (parentQueueItem === this.id) {
      this.running = true;
      this.requestedForStart = false;
      this.requestedForStop = false;
      this[EVENT_EMITTER_KEY].emit("task-stop");
      this.busy = false;
    }
  }

  on(eventName, eventHandler) {
    this[EVENT_EMITTER_KEY].on(eventName, eventHandler);
  }
}

module.exports = QueueItem;
