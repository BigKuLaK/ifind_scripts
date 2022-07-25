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

    // Listen to Task STATIC events
    Task.on('ready', this.appendReadyTasks.bind(this));
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
    return this.items.map(({ task, ...queueItem }) => ({
      ...queueItem,
      task: task.getData(),
    }));
  }

  /**
   * @returns {QueueItem}
   */
  static getItem(itemID) {
    return this.items.find(({ id }) => itemID === id);
  }

  static async startItem(itemID) {
    const startItemResponse = {
      status: 400,
      success: false,
      error: "",
    };

    const matchedItem = this.getItem(itemID);

    if (!matchedItem) {
      startItemResponse.error = `Requested start for item that is not existing.`;
    } else {
      try {
        await matchedItem.start();
        startItemResponse.status = 200;
        startItemResponse.success = true;
        this.logger.log(
          `Requested start for task ${matchedItem.task.id.bold.reset} with item ID ${matchedItem.id.bold.reset}.`
        );
      } catch (err) {
        startItemResponse.status = 500;
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

    console.info(`Requesting stop for item with ID ${itemID}`);

    const matchedItem = this.getItem(itemID);

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
      status: 500,
      success: false,
      error: "",
    };

    // Add item if there is available slot in queue
    if (currentItemsLength < maxItems) {
      try {
        const newItem = await QueueItem.create(taskID);

        newItem.on("task-stop", () => this.onItemStop(newItem.id));
        newItem.on("task-error", (errorMessage) =>
          this.onItemError(newItem.id, errorMessage)
        );

        if (newItem) {
          this.items.push(newItem);
          EVENTEMITTER.emit(EVENTS_MAP.itemAdded);

          addResponse.status = 200;
          addResponse.success = true;
          addResponse.message = `Successfully added task ${taskID} into the queue: ${newItem.id}`;
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
    const { maxParallelRun } = await this.getConfig();
    const runningQueueItems = this.items.filter(({ running }) => running);

    if (runningQueueItems.length >= maxParallelRun) {
      console.info(
        "Parallel tasks are now full, unable to start additional tasks.".magenta
      );
      return;
    }

    // Get next available task to run
    const runningTaskIDs = runningQueueItems.map(({ task }) => task.id);
    const waitingQueueItems = this.items.filter(
      ({ running, task }) => !running && !runningTaskIDs.includes(task.id)
    );

    if (waitingQueueItems.length) {
    }
  }

  static onItemStart(itemID) {}

  static onItemStop(itemID) {
    const matchedItemIndex = this.items.findIndex(({ id }) => itemID === id);

    if (matchedItemIndex > -1) {
      // - Remove item from queue
      const [deletedItem] = this.items.splice(matchedItemIndex, 1);

      // Log
      this.logger.log(
        `Successfully stopped task ${deletedItem.task.id.bold.reset} with queue item ID ${deletedItem.id.bold.reset}.`
      );
    } else {
      this.logger.log(
        `Unable to apply request. Provided item ID does not exist.`,
        'ERROR'
      );
    }
  }

  static onItemError(itemID, errorMessage) {
    const matchedItem = this.getItem(itemID);

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
    const items = this.items;

    // Collate running an non-running items
    const runningItems = [];
    const waitingItems = [];

    items.forEach((queueItem) => {});
  }

  static async appendReadyTasks() {
    const tasks = await Task.getAll();
    const readyTasks = tasks.filter(({ isReady }) => isReady);

    console.log({ readyTasks });
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

  static getList() {
    // Get tasks
    let tasks = Task.getAll();

    // Sort by name, alphabetically
    tasks.sort((taskA, taskB) =>
      taskA.name < taskB.name ? -1 : 1
    );

    return tasks;
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
