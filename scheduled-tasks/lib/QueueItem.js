const EventEmitter = require("events");
const { v4: uuid } = require("uuid");

const Task = require("./Task");

const EVENT_EMITTER_KEY = Symbol();

/**
 * @typedef {import('./Task').TaskData} TaskData
 *
 * @typedef {Object} QueueItemOptions
 * @property {string} task - the Task ID
 *
 * @typedef {'taskID' | 'requestedForStart' | 'requestedForStop' | 'running' | 'busy' | 'id' | 'status' } QueueItemDataKeys
 *
 * @typedef {Pick<QueueItem, QueueItemDataKeys> & { task: TaskData }} QueueItemData
 */

class QueueItem {
  taskID = "";
  requestedForStart = false;
  requestedForStop = false;
  running = false;
  busy = false;

  /**@type {string} */
  id = "";

  /**@type {"queued"|"running"|"stopped"} */
  status = "queued";

  /**@type {?Task} */
  task = null;

  /**
   * @param {QueueItemOptions} options
   */
  constructor({ task }) {
    this.taskID = task;
    this[EVENT_EMITTER_KEY] = new EventEmitter();
  }

  async init() {
    const tasks = await Task.getAll();
    const matchedTask = tasks.find(({ id }) => id === this.taskID);

    if (matchedTask) {
      this.task = matchedTask;

      // Listen on task events
      this.task.on("error", (error) => {
        console.log("task error fired", error);
        this[EVENT_EMITTER_KEY].emit("task-error", error);
      });
      this.task.on("exit", this.onTaskExit.bind(this));
      Task.on("start", this.onTaskStart.bind(this));

      // Add id
      this.id = uuid().replace(/-/g, "");

      Promise.resolve(this);
    } else {
      throw new Error(
        `Unable to create QueueItem. No matching task for id "${this.taskID}"`
      );
    }
  }

  /**
   * @param {string} taskID - the Task ID
   * @returns {Promise<QueueItem>}
   */
  static async create(taskID) {
    const newItem = new QueueItem({
      task: taskID,
    });

    await newItem.init();

    return newItem;
  }

  async start() {
    if (this.busy) {
      // Task might be busy starting or stopping
      return;
    }

    this.setBusy(true);
    await this.task.start(this.id);
  }

  async stop() {
    this.setBusy(true);
    this.requestedForStop = true;
    await this.task.stop();
  }

  setBusy(isBusy) {
    if (isBusy) {
      this.busy = true;

      this.busyTimeout = setTimeout(() => {
        console.info(
          `Queue item ${this.id} has been in busy state for more than 30 seconds. Stopping task.`
        );

        if (this.task) {
          this.task.stop();
        } else {
          this[EVENT_EMITTER_KEY].emit("task-stop");
        }
      }, 30000);
    } else {
      this.busy = false;
      clearTimeout(this.busyTimeout);
    }
  }

  onTaskStart(taskData) {
    const { parentQueueItem } = taskData;

    // Ensure we are referring to this queueItem
    if (parentQueueItem === this.id) {
      this.status = "running";
      this.running = true;
      this.requestedForStart = false;
      this[EVENT_EMITTER_KEY].emit("task-start");
      this.setBusy(false);
    }
  }

  onTaskExit(taskData) {
    const { parentQueueItem } = taskData;

    if (parentQueueItem === this.id) {
      this.status = "stopped";
      this.running = false;
      this.requestedForStart = false;
      this.requestedForStop = false;
      this[EVENT_EMITTER_KEY].emit("task-stop");
      this.setBusy(false);
    }
  }

  on(eventName, eventHandler) {
    this[EVENT_EMITTER_KEY].on(eventName, eventHandler);
  }
}

module.exports = QueueItem;
