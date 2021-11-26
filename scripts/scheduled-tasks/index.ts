import "colors";
const path = require("path");
const fs = require("fs-extra");
const moment = require("moment");
const { existsSync } = require("fs-extra");
const childProcess = require("child_process");

const baseDir = path.resolve(__dirname);
const configPath = path.resolve(baseDir, "config");
const config = existsSync(configPath) ? require(configPath) : {};
const timer = require("./lib/Timer");
const Task = require("./lib/Task");
const Database = require("./lib/Database");
const Logger = require("./lib/Logger");
const Queue = require("./lib/Queue");
const mapScheduleToFrequency = require("./utils/mapScheduleToFrequency");

const LOGGER = new Logger({ baseDir });

export default class ScheduledTasks {
  ID: string | number;
  initialized: boolean = false;

  // List of all available processes, by id
  tasks: { [key: string]: TaskEntity } = {};

  // ID of the currently running task
  runningTask = '';

  // Valid hook names
  hookNames = {
    TASK_STOP: "task-stop",
  };

  constructor() {
    this.ID = Date.now();
  }

  init() {
    if (this.initialized) {
      return;
    }

    // Info from queue
    Queue.on("info", (info: string) => LOGGER.log(info));

    this.initialized = true;

    // Check tasks config for changes and apply updates
    const configTasks = config.tasks;
    const dbTasks = Database.getAll(Task.model);

    configTasks.forEach((configTask: TaskEntity) => {
      const dbTask = dbTasks.find((task: TaskEntity) => task.id === configTask.id);

      // Check for changes and save if there is any
      if (
        dbTask.name !== configTask.name ||
        dbTask.schedule !== configTask.schedule
      ) {
        Database.update(Task.model, dbTask.id, {
          name: configTask.name,
          schedule: configTask.schedule,
        });
      }

      this.addTask({
        ...dbTask,
        name: configTask.name,
        schedule: configTask.schedule,
      });
    });

    // Initialize timer
    timer.on("taskstart", this.start.bind(this));
    timer.init();

    LOGGER.log("Scheduled Tasks Runner initialized".magenta.bold);

    // TEST
    this.fireHook("task-stop", "test-task-id");
  }

  runCommand(command: string, id: string) {
    const validCommands = ["start", "stop"];
    if (validCommands.includes(command)) {
      const args = [id];

      switch (command) {
        case "start":
          args.push("true");
          break;
        default:
      }

      (this as GenericObject)[command].apply(this, args);
    }

    return this.list();
  }

  /**
   * Gets the list of all available tasks
   */
  list() {
    // Get updated tasks list
    const tasks = Queue.getList();

    tasks.forEach((dbTask: TaskEntity) => {
      const matchedCachedTask = this.tasks[dbTask.id];

      if (matchedCachedTask) {
        matchedCachedTask.next_run = dbTask.next_run;
      }
    });

    // Apply formated schedule datetime
    return Object.values(this.tasks)
      .map((task) => ({
        ...task,
        frequency: mapScheduleToFrequency(task.schedule),
      }))
      .sort((taskA, taskB) => (taskA.next_run < taskB.next_run ? -1 : 1));
  }

  start(id: string, resetNextRun = false) {
    if (!(id in this.tasks)) {
      LOGGER.log(
        `${id.bold} is not in the list of tasks. Kindly verify the task ID.`
      );
      return;
    }

    if (this.runningTask) {
      if (this.runningTask === id) {
        LOGGER.log(`Task is still running.`.cyan);
      } else {
        LOGGER.log(
          `Unable to run `.yellow +
            id.yellow.bold +
            `. Another task is currently running - `.yellow +
            this.runningTask.yellow.bold
        );
      }

      if (Queue.isTaskDueToRun(this.tasks[id])) {
        this.tasks[id].computeNextRun();
      }

      return;
    }

    this.runningTask = id;

    LOGGER.log(` Starting task: `.bgGreen.black.bold + `${id} `.bgGreen.black);
    const task = this.tasks[id];

    // Manually running a task allows
    // to reset the next_run at the current time
    // so that the computed next_run will base on the current time
    if (resetNextRun) {
      task.update({
        next_run: Date.now(),
      });
    }

    // Start task
    task.start();

    // Show updated queue for the next run
    const newQueue = Queue.getList();
    LOGGER.log(`New queue:`.green.bold);
    newQueue.forEach(({ id, next_run }: TaskEntity, index: number) => {
      LOGGER.log(
        ` ${index + 1} - ${id.bold} - ${moment
          .utc(next_run)
          .format("YYYY-MM-DD HH:mm:ss")} ${
          this.runningTask === id ? "- running".yellow.bold : ""
        }`
      );
    });
  }

  stop(id: string) {
    if (id in this.tasks) {
      const _process = this.tasks[id];
      LOGGER.log(`Killing task: ${id.bold}`);
      _process.stop();
    }
  }

  getLogs() {
    return LOGGER.getAll();
  }

  getTask(taskID: string) {
    if (taskID in this.tasks) {
      const taskData = this.tasks[taskID];
      return {
        ...taskData,
        logs: this.tasks[taskID].getLogs(),
      };
    }
  }

  addTask(taskData: TaskData) {
    const task = Task.initializeWithData(taskData);

    // Handle task events
    task.on("message", (...args: any[]) => this.onProcessMessage(args));
    task.on("exit", () => this.onProcessExit(task.id));

    // Save task to list
    this.tasks[task.id] = task;
  }

  onProcessMessage(processArgs: any[]) {
    LOGGER.log({ processArgs });
  }

  onProcessExit(id: string) {
    this.runningTask = '';
    LOGGER.log(` Process exitted: `.black.bgCyan.bold + `${id} `.black.bgCyan);
    this.fireHook(this.hookNames.TASK_STOP, id);
  }

  async fireHook(hookName: string, data: any) {
    const isValidHookName = Object.values(this.hookNames).includes(hookName);
    const hookPath = path.resolve(__dirname, "hooks", `${hookName}.js`);
    const hookPathExists = fs.existsSync(hookPath);

    if (isValidHookName && hookPathExists) {
      LOGGER.log([`Running hook`.cyan, hookName.cyan.bold].join(" "));

      // Require and run hook
      const hookProcess = childProcess.fork(hookPath, [], { stdio: "pipe" });

      hookProcess.on("message", (jsonString: string) => {
        const { event } = JSON.parse(jsonString);

        if (event === "init") {
          // Send a trigger to the process to start
          hookProcess.send(
            JSON.stringify({
              command: "start",
              data: data,
            })
          );
        }
      });

      await new Promise((resolve, reject) => {
        hookProcess.on("exit", resolve);
        hookProcess.stdout.on("data", (data: NodeJS.ReadStream) => LOGGER.log(data.toString()));
        hookProcess.stderr.on("data", (data: NodeJS.ReadStream) =>
          LOGGER.log(data.toString(), "ERROR")
        );
        hookProcess.on("error", (error: Error) => {
          LOGGER.log(error.message, "ERROR");
          reject();
        });
      });

      LOGGER.log(" DONE".green.bold);
    }
  }
}

const scheduledTasks = new ScheduledTasks;
scheduledTasks.init();
