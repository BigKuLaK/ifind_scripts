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

/**
 * TODO: Make this persistent (Save to DB)
 * @type QueueConfig
 */
const CONFIG = {
  maxItems: 10,
  maxParallelRun: 2,
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
  static startingTask = false;

  /**
   *
   */
  static async init() {
    await EVENTEMITTER.on(EVENTS_MAP.itemAdded, this.onItemAdded.bind(this));

    // Listen to Task STATIC events
    Task.on("ready", this.onTaskReady.bind(this));

    // Initial calls
    await this.appendReadyTasks();

    process.on("SIGINT", () => {
      this.stopAll();
    });
  }

  /**
   * @param {keyof QueueConfig} [configName]
   * @returns {QueueConfig|string|number}
   */
  static async getConfig(configName) {
    if (configName && configName in CONFIG) {
      return CONFIG[configName];
    }

    return CONFIG;
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

  static async isFull() {
    const maxItems = await this.getConfig('maxItems');
    return this.items.length >= maxItems;
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
        this.logger.log(err.message, "ERROOR");
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

    this.logger.log(`Requesting stop for item with ID ${itemID}`);

    const matchedItem = this.getItem(itemID);

    if (!matchedItem) {
      stopItemResponse.error = `Requested stop for item that is not existing.`;
    } else {
      try {
        await matchedItem.stop();
        stopItemResponse.success = true;
      } catch (err) {
        stopItemResponse.error = err.message;
        this.logger.log(err.message, "ERROR");
        console.error(err);
      }
    }

    return stopItemResponse;
  }

  static async add(taskID) {
    this.logger.log(`Adding task: ${taskID}`);
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

        if (newItem) {
          newItem.on("task-stop", () => this.onItemStop(newItem.id));
          newItem.on("task-error", (errorMessage) =>
            this.onItemError(newItem.id, errorMessage)
          );
          newItem.task.resetCountdown();

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
        this.logger.log(err.message, "ERROR");
        console.error(err);
        addResponse.message = `Unable to add Task due to error: ${err.message}`;
      }
    }

    this.logger.log(
      addResponse.message,
      addResponse.success ? "INFO" : "ERROR"
    );

    return addResponse;
  }

  static async onTaskReady(taskID) {
    if (await this.isQueueFull()) {
      this.logger.log(
        "Queue is now full, can't add more items as of the moment."
      );
      return;
    }

    await this.add(taskID);
  }

  static async onItemAdded() {
    await this.runWaitingItems();
  }

  static onItemStart(itemID) {}

  static async onItemStop(itemID) {
    const matchedItemIndex = this.items.findIndex(({ id }) => itemID === id);

    if (matchedItemIndex > -1) {
      // - Remove item from queue
      const [deletedItem] = this.items.splice(matchedItemIndex, 1);

      // Log
      this.logger.log(
        `Successfully stopped task ${deletedItem.task.id.bold.reset} with queue item ID ${deletedItem.id.bold.reset}.`
      );

      // Append ready tasks
      await this.appendReadyTasks();
    } else {
      this.logger.log(
        `Unable to apply request. Provided item ID does not exist.`,
        "ERROR"
      );
    }
  }

  static onItemError(itemID, errorMessage) {
    const matchedItem = this.getItem(itemID);

    if (matchedItem) {
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
    } else {
      this.logger.log(`Error from unknown task: ${errorMessage}`, "ERROR");
    }
  }

  /**
   * Runs next available QueueItem
   */
  static async runWaitingItems() {
    this.logger.log("Running waiting items.".green);

    const maxParallelRun = await this.getConfig("maxParallelRun");
    const runningQueueItems = this.items.filter(({ running }) => running);

    if (runningQueueItems.length >= maxParallelRun) {
      this.logger.log(
        "Parallel tasks are now full, unable to start waiting tasks.".magenta
      );
      return;
    }

    // Get next available task to run
    const runningTaskIDs = runningQueueItems.map(({ task }) => task.id);
    const waitingQueueItems = this.items.filter(
      ({ running, task }) => !running && !runningTaskIDs.includes(task.id)
    );
    console.log({ waitingQueueItems: waitingQueueItems.length });

    if (!waitingQueueItems.length) {
      this.logger.log(`No items are available to run.`);
      return;
    }

    const itemsToRun = waitingQueueItems.slice(
      0,
      maxParallelRun - runningQueueItems.length
    );

    await Promise.all(
      itemsToRun.map(async (queueItem) => await queueItem.start())
    );
  }

  static async isQueueFull() {
    // Check if queue is not yet full
    const maxItems = await this.getConfig("maxItems");
    return maxItems <= this.items.length;
  }

  static async appendReadyTasks() {
    this.logger.log("Checking for READY items to append into the queue.");

    if (await this.isQueueFull()) {
      this.logger.log(
        "Queue is now full, can't add more items as of the moment."
      );
      return;
    }

    const tasks = await Task.getAll();
    const readyTasks = tasks.filter(({ isReady }) => isReady);

    // If no ready tasks remaining, just run the waiting items in the Queue
    if (!readyTasks.length) {
      await this.runWaitingItems();
      return;
    }

    // Sort by priority
    readyTasks.sort((taskA, taskB) =>
      taskA.priority < taskB.priority ? -1 : 1
    );

    // Get first ready task, and add into the queue
    const [firstTask, ...remainingTasks] = readyTasks;

    await this.add(firstTask.id);
    await firstTask.resetCountdown();

    // If there are other ready tasks left,
    // Re-run the append to check if possible to add more tasks
    if (remainingTasks.length) {
      await this.appendReadyTasks();
    }
  }

  static async stopAll() {
    const tasks = await Task.getAll();

    this.logger.log("Force stopping all running tasks");
    tasks.forEach((task) => {
      if (task.process) {
        task.process.kill("SIGKILL");
      }
    });
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
    tasks.sort((taskA, taskB) => (taskA.name < taskB.name ? -1 : 1));

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
