const { existsSync } = require("fs-extra");
const childProcess = require("child_process");
const path = require("path");
const EventEmitter = require("events");
const moment = require("moment");

const Tasks = require("../../ifind-utilities/airtable/models/tasks");
const TaskFrequencies = require("../../ifind-utilities/airtable/models/task_frequencies");
const DealTypes = require("../../ifind-utilities/airtable/models/deal_types");

const baseDir = path.resolve(__dirname, "../");
const configPath = path.resolve(baseDir, "config");
const config = existsSync(configPath) ? require(configPath) : {};

const tasksRoot = path.resolve(__dirname, "../tasks");
const { frequencies } = require("../config");
const Database = require("./Database");
const Logger = require("./Logger");
const Model = require("./Model");

const EVENT_EMITTER_KEY = Symbol();
const COUNTDOWN_TIMEOUT_KEY = Symbol();
const EVENT_EMITTER_KEY_STATIC = Symbol();

const STATUS_RUNNING = "running";
const STATUS_STOPPED = "stopped";

/**
 * TYPEDEFS
 *
 * @typedef {import('airtable').Record<any>} Record
 * @typedef {import('airtable').Records<any>} Records
 */

/**@type {Records} */
let taskFrequencies = [];

/**@type {Records} */
let dealTypes = [];

/**
 * @param {Record} recordData
 * @param {Task} taskInstance
 */
const applyRecordToTask = (recordData, taskInstance, additionalData) => {
  const matchedFrequencyRecord = taskFrequencies.find(
    (frequencyRecordData) =>
      frequencyRecordData.id === recordData.get("schedule")[0]
  );

  const matchedDealTypeRecord = dealTypes.find(
    (dealTypeRecordData) =>
      dealTypeRecordData.id === recordData.get("meta_deal_type")[0]
  );

  taskInstance.name = recordData.get("name");
  taskInstance.last_run = recordData.get("last_run");
  taskInstance.schedule =
    matchedFrequencyRecord?.get("frequency_ms") || 1000 * 60 * 60; // Default to 1 hr
  taskInstance.meta = {
    deal_type: matchedDealTypeRecord ? matchedDealTypeRecord.get("id") : null,
  };

  this.priority = additionalData.priority;
};

/**
 * Task base class
 *
 * A Task should have a corresponding BackgroundProcess
 * This class only triggers a BackgroundProcess to start/stop
 * This does not contain any logic for the BackgroundProcess
 */
class Task extends Model {
  // QueueItem that triggers this task to start
  parentQueueItem = null;

  process = null;

  requestedForStart = false;

  isReady = false;

  canQueue = true;

  timeoutID = null;

  name = null;

  last_run = null;

  /**@type {any} */
  meta = null;

  /**@type {import('airtable').Record<any> | null} */
  recordData = null;

  // Singleton instance list of the tasks
  static all = {};

  /**@param {Record} recordData */
  constructor(recordData, computedData) {
    super();

    this.recordData = recordData;

    this.id = recordData.get("id");

    applyRecordToTask(recordData, this, computedData);

    this.isReady = false;
    this.isAdded = false;
    this.next_run = null;

    this.status = STATUS_STOPPED;

    // Get taskModulePath
    this.taskModulePath = path.resolve(tasksRoot, this.id);
    this.taskModuleFile = path.resolve(this.taskModulePath, "index.js");
    this.hasModule = existsSync(this.taskModuleFile);

    // Logger
    this.logger = new Logger({ context: "task-" + this.id });

    if (!this.isReady) {
      // this.resetCountdown();
    }

    // Ensure no other process for this task is running on initialization
    // this.cleanupIdleProcesses();

    // this.on("update", this.onUpdate.bind(this));
  }

  get running() {
    return this.status === STATUS_RUNNING;
  }

  async start(parentQueueItem) {
    if (this.requestedForStart) {
      console.warn(
        `Process for this task is already requested for start (${this.id})`
          .yellow
      );
      return;
    }

    await this.update({ requestedForStart: true });

    if (this.timeoutMs) {
      // Automatically stop task if its running more than the timeout
      // Commenting to check if it disturbs the automatic flow
      setTimeout(() => {
        this.log(`Stopping task due to timeout: ${this.id}`, "ERROR");
        this.stop();
      }, this.timeoutMs);
    }

    const hasOtherProcess = await this.checkOtherProcessInstance();

    if (hasOtherProcess) {
      console.warn(
        `Process for this task is already running (${this.id})`.yellow
      );
      return;
    }

    this.log(`STARTING TASK: ${this.id}`.bold.green, "INFO");

    if (this.hasModule && !this.running) {
      this.parentQueueItem = parentQueueItem;

      await Promise.all([this.setRunning(), this.computeNextRun()]);

      this.watchLogIdle();

      this.process = childProcess.fork(this.taskModuleFile, [], {
        stdio: "pipe",
        env: process.env,
      });

      this.process.stdout.on("data", (data) => this.log(data.toString()));
      this.process.stderr.on("data", (data) => {
        const errorData = data
          .toString()
          .trim()
          .replace(/[\r\n]/g, "<br>");
        this.log(errorData, "ERROR");
        this.emit("error", errorData);
      });

      this.process.on("exit", async () => {
        this.onClose();
      });
    }

    this.requestedForStart = false;
  }

  stop() {
    if (this.running && this.process) {
      this.process.kill("SIGINT");

      // Force stop task if not yet fully stopped after 10 seconds
      this.processStopTimeout = setTimeout(() => {
        this.log(`Process is still not stopped. Forcing...`.yellow);
        this.onClose();
      }, 1000 * 10);
    }
  }

  onClose() {
    if (this.processStopTimeout) {
      clearTimeout(this.processStopTimeout);
      delete this.processStopTimeout;
    }

    const taskData = this.getData();
    this.setStopped();
    this.saveLastRun();

    this.emit("exit", taskData);
    Task[EVENT_EMITTER_KEY_STATIC].emit("exit", taskData);

    this.parentQueueItem = null;
    this.requestedForStart = false;

    // Ensure this process as well as child processes (e.g., puppeteer) are killed
    this.process.kill("SIGKILL");
    this.process = null;
  }

  setPosition(position) {
    console.log("Setting position for this task :", this.name);
    this.position = position;
  }

  setRunning() {
    this.status = STATUS_RUNNING;

    const taskData = this.getData();

    this.emit("start", taskData);
    Task[EVENT_EMITTER_KEY_STATIC].emit("start", taskData);
  }

  setReady(isReady) {
    if (typeof isReady !== "boolean") {
      return;
    }

    if (this.isReady !== isReady) {
      this.isReady = isReady;
      this.update({ isReady: isReady });

      if (isReady) {
        Task[EVENT_EMITTER_KEY_STATIC].emit("ready", this.id);
      }
    }
  }

  setStopped() {
    this.status = STATUS_STOPPED;
  }

  setSchedule(countdownTime) {
    this.schedule = countdownTime;
  }

  setPriority(priority) {
    this.priority = priority;
  }

  setCanQueue(canQueue) {
    this.canQueue = canQueue;
  }

  /**
   *
   * @param {Number} afterTime - timestamp after which logs are filtered
   * @returns LogEntry[]
   */
  async getLogs(afterTime) {
    return await this.logger.getAll(afterTime);
  }

  log(message = "", type) {
    if (this.loggerIdleTimeout) {
      this.watchLogIdle();
    }

    this.logger.log(message, type);
  }

  // Computes next run schedule depending on config.shedule
  // Save the computed update in database
  async computeNextRun() {
    const now = Date.now();
    const { schedule } = this;

    while (!this.next_run || this.next_run <= now) {
      this.next_run = this.next_run + (schedule || frequencies); // Default to daily
    }

    // Save to DB
    Database.update(Task.model, this.id, { next_run: this.next_run });
  }

  reinitializeTimeout() {
    const now = Date.now();

    clearTimeout(this[COUNTDOWN_TIMEOUT_KEY]);
    const timeoutMs = this.next_run - now || 0;

    // Countdown timer until this task is ready
    this[COUNTDOWN_TIMEOUT_KEY] = setTimeout(
      this.onCountdownDone.bind(this),
      timeoutMs
    );
  }

  async resetTimer() {
    await this.computeNextRun();
    this.reinitializeTimeout();
  }

  async resetCountdown() {
    this.setReady(false);
    await this.resetTimer();
  }

  onCountdownDone() {
    const now = Date.now();
    const timeout = this.next_run - now;

    // Ensure timeout reaches 0
    if (timeout <= 0) {
      this.setReady(true);
    } else {
      this.resetTimer();
    }
  }

  // Saves last_run
  async saveLastRun() {
    const now = moment.utc().valueOf();

    // Save to DB
    Database.update(Task.model, this.id, { last_run: now });
  }

  // Adjusts next run by the given milliseconds
  adjustNextRun(milliseconds = 0) {
    const next_run = (this.next_run || Date.now()) + milliseconds;

    // Save
    this.update({ next_run });
  }

  async checkOtherProcessInstance() {
    const existingProcesses = await this.getOtherProcessInstances();
    return existingProcesses.length > 0;
  }

  async getOtherProcessInstances() {
    const existingProcess = childProcess
      .execSync(`ps -ef | grep ${this.taskModuleFile}`)
      .toString()
      .split("\n")
      .filter((lineMatch) => lineMatch && !/\sgrep\s/.test(lineMatch));

    return existingProcess;
  }

  async cleanupIdleProcesses() {
    const otherProcesses = await this.getOtherProcessInstances();

    if (otherProcesses.length) {
      console.info(`Cleaning up idle processes for task: ${this.id}`);

      otherProcesses.forEach((processInfo) => {
        const infoParts = processInfo.split(/\s+/);
        const PID = infoParts[1];
        process.kill(PID, "SIGKILL");
      });
    }
  }

  // Watches for this task's logger activity
  // If this.log hasn't been called for more than 10 minutes,
  // Stop the task
  watchLogIdle() {
    clearTimeout(this.loggerIdleTimeout);

    this.loggerIdleTimeout = setTimeout(() => {
      clearTimeout(this.loggerIdleTimeout);
      delete this.loggerIdleTimeout;

      this.log("Logger has been idle for 30 minutes. Stopping task.".yellow);
      this.stop();
    }, 1000 * 60 * 30);
  }

  onUpdate() {
    this.reinitializeTimeout();
  }

  getData() {
    const taskData = this.sanitizeData(this);

    // Append additional data
    taskData.parentQueueItem = this.parentQueueItem;
    taskData.isReady = this.isReady;
    taskData.canQueue = this.canQueue;
    taskData.status = this.status;

    return taskData;
  }

  static async getAll() {
    console.log("Getting all");
    // Get all tasks data
    const [frequencyRecords, taskRecords, dealTypeRecords] = await Promise.all([
      !taskFrequencies.length ? TaskFrequencies.all() : taskFrequencies,
      Tasks.all(),
      DealTypes.all(),
    ]);

    taskFrequencies = frequencyRecords;
    dealTypes = dealTypeRecords;

    const newAllTasksMap = {};

    // Initialize each task using record data
    taskRecords.forEach((taskRecord, index) => {
      const priority = index + 1;

      const taskID = taskRecord.get("id");
      if (!(taskID in this.all)) {
        newAllTasksMap[taskID] = this.initializeWithData(taskRecord, {
          priority,
        });
      } else {
        newAllTasksMap[taskID] = this.all[taskID];
        applyRecordToTask(taskRecord, newAllTasksMap[taskID], {
          priority,
        });
      }
    });

    // Replace old list wth new one
    this.all = newAllTasksMap;

    return Object.values(this.all);
  }

  static async get(taskID) {
    const allTasks = await this.getAll();
    const matchedTask = allTasks.find(({ id }) => id === taskID);

    if (matchedTask) {
      return matchedTask;
    } else {
      return null;
    }
  }

  static initializeWithData(recordData, additionalData) {
    const instance = new Task(recordData, additionalData);
    return instance;
  }
}

/**
 * Static props
 */
Task.model = "task";
// Used to listen/trigger STATIC events
Task[EVENT_EMITTER_KEY_STATIC] = new EventEmitter();

/**
 * Static methods
 *
 */
Task.on = function (event, handler) {
  Task[EVENT_EMITTER_KEY_STATIC].on(event, handler);
};

module.exports = Task;
