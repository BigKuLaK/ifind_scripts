require("colors");
const moment = require("moment");
const EventEmitter = require("events");
const Task = require("./Task");
const QueueItem = require("./QueueItem");
const Logger = require("./Logger");

/**
 * @typedef {Object} QueueConfig
 * @property {Number} maxItems - Maximum number of items that can be added into the queue
 * @property {Number} maxParallelRun - Maximum number of items that can run simultaneously
 */

const EVENTEMITTER = new EventEmitter();

const EVENTS_MAP = {
  itemAdded: "item-added",
};

class Queue {
  /**
   *
   */
  static items = [];

  /**
   *
   */
  static logger = new Logger({ context: "scheduled-tasks-runner" });

  /**
   *
   */
  static init() {
    EVENTEMITTER.on(EVENTS_MAP.itemAdded, this.onItemAdded.bind(this));
  }

  /**
   * @param {keyof QueueConfig} [configName]
   * @returns {QueueConfig|string|number}
   */
  static async getConfig(configName) {
    /**
     * TODO: Make this persistent (Save to DB)
     * @type QueueConfig
     */
    const config = {
      maxItems: 10,
      maxParallelRun: 2,
    };

    if (configName && configName in config) {
      return config[configName];
    }

    return config;
  }

  /**
   * @returns {QueueItem[]}
   */
  static getItems() {
    return this.items;
  }

  /**
   * @returns {QueueItem}
   */
  static getItem(itemID) {
    return [
      // Item  data
      this.items.find(({ id }) => itemID === id),
      // Item  index
      this.items.findIndex(({ id }) => itemID === id),
    ];
  }

  static async startItem(itemID) {
    const startItemResponse = {
      success: false,
      error: "",
    };

    const [matchedItem] = this.getItem(itemID);

    if (!matchedItem) {
      startItemResponse.error = `Requested start for item that is not existing.`;
    } else {
      try {
        await matchedItem.start();
        startItemResponse.success = true;
        this.logger.log(
          `Requested start for task ${matchedItem.task.id.bold.reset} with item ID ${matchedItem.id.bold.reset}.`
        );
      } catch (err) {
        startItemResponse.error = err.message;
        console.error(err);
      }
    }

    return startItemResponse;
  }

  static async stopItem(itemID) {
    const stopItemResponse = {
      success: false,
      error: "",
    };

    console.log({ toStop: itemID });

    const [matchedItem] = this.getItem(itemID);

    if (!matchedItem) {
      stopItemResponse.error = `Requested stop for item that is not existing.`;
    } else {
      try {
        await matchedItem.stop();
        stopItemResponse.success = true;
      } catch (err) {
        stopItemResponse.error = err.message;
        console.error(err);
      }
    }

    return stopItemResponse;
  }

  static async add(taskID) {
    const maxItems = await this.getConfig("maxItems");
    const currentItemsLength = this.items.length;
    const addResponse = {
      success: false,
      error: "",
    };

    // Add item if there is available slot in queue
    if (currentItemsLength < maxItems) {
      try {
        const newItem = await QueueItem.create(taskID);

        newItem.on("task-start", () => this.onItemStart(newItem.id));
        newItem.on("task-stop", () => this.onItemStop(newItem.id));
        newItem.on("task-error", (errorMessage) =>
          this.onItemError(newItem.id, errorMessage)
        );

        if (newItem) {
          this.items.push(newItem);
          EVENTEMITTER.emit(EVENTS_MAP.itemAdded);

          addResponse.success = true;
          addResponse.message = `Successfully added task ${taskID} into the queue.`;
        } else {
          addResponse.message =
            "Unable to add Task for unknown reason. Check codes to verify.";
        }
      } catch (err) {
        console.error(err);
        addResponse.message = `Unable to add Task due to error: ${err.message}`;
      }
    }

    this.logger.log(
      addResponse.message,
      addResponse.success ? "INFO" : "ERROR"
    );
    this.onItemAdded();

    return addResponse;
  }

  static async onItemAdded() {
    // - Check for next task to run
  }

  static onItemStart(itemID) {}

  static onItemStop(itemID) {
    const [matchedItem, itemIndex] = this.getItem(itemID);

    // - Remove item from queue

    // Log
    this.logger.log(
      `Successfully stopped task ${matchedItem.task.id.bold.reset} with queue item ID ${matchedItem.id.bold.reset}.`
    );
  }

  static onItemError(itemID, errorMessage) {
    const [matchedItem] = this.getItem(itemID);

    this.logger.log(
      [
        `Error on task `,
        matchedItem.task.id.reset,
        ` from queue item `,
        matchedItem.id.bold.reset,
        ` - ${errorMessage.gray.reset}`,
      ].join(""),
      "ERROR"
    );
  }

  /**
   * Runs next available QueueItem
   */
  static async runAvailable() {
    const maxItems = await this.getConfig("maxItems");
    const list = this.list;

    // Collate running an non-running items
    const runningItems = [];
    const waitingItems = [];

    list.forEach((queueItem) => {});
  }

  /**
   *
   * @param {String} eventName
   * @param {Function} eventHandler
   */
  static on(eventName, eventHandler) {
    EVENTEMITTER.on(eventName, eventHandler);
  }

  /**
   * SUCCEEDING BLOCKS ARE OLD IMPLEMENTATION
   */

  // When checking for a task's next_run, allow this allowance in milliseconds
  // To determine whether the task is due to run (plus/minus)
  static TASK_NEXT_RUN_ALLOWANCE = 1000 * 1; // +/- 1 seconds allowance

  static getList(recomputePastTasks = false) {
    // Current Time
    const currentTime = Date.now();

    // Get tasks
    let tasks = Task.getAll();

    // Compute tasks' next run values if flagged
    const computedTasks = tasks.map((task) => {
      if (!recomputePastTasks) {
        return task;
      }

      const oldNextRun = task.next_run;

      if (task.next_run < currentTime && !this.isTaskDueToRun(task)) {
        EVENTEMITTER.emit(
          "info",
          `Task ${task.id.bold} is past due. Recomputing...`
        );
      }

      // Ensure there is next_run
      // Or next_run is within the runnable allowance
      while (
        !task.next_run ||
        (task.next_run < currentTime && !this.isTaskDueToRun(task))
      ) {
        console.log(`${task.id.bold}: task not yet due to run, recomputing`);
        task.computeNextRun();

        EVENTEMITTER.emit(
          "info",
          `Updated next_run for ${task.id.bold}: ${
            moment.utc(task.next_run).format("YYY-MM-DD HH:mm:ss").bold
          }`
        );
      }

      return task;
    });

    // Ensure no 2 tasks have the same next_run
    computedTasks.forEach((task) => {
      const taskWithSameTime = computedTasks.find(
        (otherTask) =>
          otherTask.id !== task.id && otherTask.next_run === task.next_run
      );

      // If there's another task that will run the same time,
      // Adjust this task's next_run to 10mins
      if (taskWithSameTime) {
        task.adjustNextRun(1000 * 60 * 10);
      }
    });

    // Sort by next_run
    computedTasks.sort((taskA, taskB) =>
      taskA.next_run < taskB.next_run ? -1 : 1
    );

    // Place the currently running task at the beginning
    const runningTaskIndex = computedTasks.findIndex((task) => task.running);
    if (runningTaskIndex >= 0) {
      computedTasks.unshift(computedTasks.splice(runningTaskIndex, 1)[0]);
    }

    return computedTasks;
  }

  static isTaskDueToRun(task) {
    const timeNow = Date.now();
    const nextRunDiff = Math.abs(task.next_run - timeNow);

    // Returns true if time difference between time now and next_run
    // is within the allowance
    return nextRunDiff <= this.TASK_NEXT_RUN_ALLOWANCE;
  }
}

module.exports = Queue;
