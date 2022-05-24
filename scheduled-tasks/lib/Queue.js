const moment = require("moment");
const EventEmitter = require("events");
const Task = require("./Task");

const EVENTEMITTER = new EventEmitter();

const Queue = {
  // When checking for a task's next_run, allow this allowance in milliseconds
  // To determine whether the task is due to run (plus/minus)
  TASK_NEXT_RUN_ALLOWANCE: 1000 * 1, // +/- 1 seconds allowance

  on(eventName, eventHandler) {
    EVENTEMITTER.on(eventName, eventHandler);
  },

  getList(recomputePastTasks = false) {
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
  },

  isTaskDueToRun(task) {
    const timeNow = Date.now();
    const nextRunDiff = Math.abs(task.next_run - timeNow);

    // Returns true if time difference between time now and next_run
    // is within the allowance
    return nextRunDiff <= this.TASK_NEXT_RUN_ALLOWANCE;
  },
};

module.exports = Queue;
