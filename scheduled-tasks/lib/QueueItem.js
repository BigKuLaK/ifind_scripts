const moment = require("moment");
const EventEmitter = require("events");
const { v4: uuid } = require("uuid");

const Task = require("./Task");
const Logger = require("./Logger");

const EVENTEMITTER = new EventEmitter();

/**
 * @typedef {Object} QueueItemOptions
 * @property {string} task - the Task ID
 */

class QueueItem {
  /**
   * @param {QueueItemOptions} options
   */
  constructor({ task }) {
    const tasks = Task.getAll();
    const matchedTask = tasks.find(({ id }) => id === task);

    if (matchedTask) {
      this.task = matchedTask;

      // Listen on task events
      this.task.on("start", () => EVENTEMITTER.emit("task-start"));
      this.task.on("error", (error) => EVENTEMITTER.emit("task-error", error));
      this.task.on("exit", (exitCode) => EVENTEMITTER.emit("task-stop", exitCode));

      // Add id
      this.id = uuid();
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
    await this.task.start();
  }

  async stop() {
    await this.task.stop();
  }

  on(eventName, eventHandler) {
    EVENTEMITTER.on(eventName, eventHandler);
  }
}

module.exports = QueueItem;
