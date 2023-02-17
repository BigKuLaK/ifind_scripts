const moment = require("moment");
const ScheduledTasks = require("../scheduled-tasks");
const Task = require("../scheduled-tasks/lib/Task");
const Queue = require("../scheduled-tasks/lib/Queue");
const mapScheduleToFrequency = require("../scheduled-tasks/utils/mapScheduleToFrequency");
const formatGranularTime = require("../scheduled-tasks/utils/formatGranularTime");

class TaskController {
  // Tasks listing
  static async index(req, res) {
    try {
      const serverTime = moment.utc().valueOf();
      const queueConfig = await Queue.getConfig();
      const scheduledTask =
        req.app.get("scheduledTasks") || ScheduledTasks.getInstance();
      scheduledTask.init();

      const logs = await scheduledTask.getLogs();
      const queue = await Queue.getItems();
      const full = await Queue.isFull();
      const taskInstances = queue.reduce((allInstances, { task }) => {
        if (!(task.id in allInstances)) {
          allInstances[task.id] = 0;
        }

        allInstances[task.id]++;

        return allInstances;
      }, {});

      const tasks = (await Task.getAll()).map((task) => {
        const taskData = task.getData();
        const countdown =
          task.isReady || task.next_run <= serverTime
            ? 0
            : task.next_run - serverTime;

        return {
          ...taskData,
          isReady: task.isReady || task.next_run <= serverTime,
          frequency: taskData.schedule_name,
          countdown: formatGranularTime(
            countdown > taskData.schedule ? taskData.schedule : countdown
          ),
          canQueue: !taskInstances[task.id] || taskInstances[task.id] < 2,
          // Include original task data
          taskData,
        };
      });

      // Sort tasks by priority
      tasks.sort((taskA, taskB) => (taskA.priority < taskB.priority ? -1 : 1));

      return res.status(200).json({
        success: true,
        logs: logs,
        limit: queueConfig.maxItems,
        parallel: queueConfig.maxParallelRun,
        full,
        tasks,
        queue,
      });
    } catch (e) {
      console.log("error", e);
      console.log("error message", e.msg);
      return res.status(500).json({
        success: "false",
        msg: e.msg,
      });
    }
  }

  static async enqueue(req, res) {
    try {
      const scheduledTask = ScheduledTasks.getInstance();
      let taskId = req.body.taskID;
      let id = taskId;

      let addedTasks = scheduledTask.getQueue();
      const queueLength = addedTasks.length;

      // Check if queue is full
      if (queueLength == ScheduledTasks.LIMIT) {
        return;
      }
      scheduledTask.runCommand("start", id);
      scheduledTask.enqueue(taskId);
      return res.status(200).json({
        sucess: "true",
      });
    } catch (e) {
      console.log(e);
      return res.status(500).json({
        success: "false",
        msg: e.msg,
      });
    }
  }

  static async update(req, res) {
    const { task } = req.query;

    const matchedTask = await Task.get(task);

    if (matchedTask) {
      try {
        matchedTask.update(req.body);

        if ("next_run" in req.body) {
          matchedTask.resetTimer();
        }

        res.status(200).json({
          success: true,
        });
      } catch (err) {
        res.status(500).json({
          error: err.message,
        });
      }
    } else {
      res.status(400).json({
        error: `No task with ID ${task} was found.`,
      });
    }
  }

  static async priority(req, res) {
    const { task } = req.query;
    const { priority: targetPriority } = req.body;

    const allTasks = await Task.getAll();
    const matchedTask = allTasks.find(({ id }) => task === id);

    if (matchedTask) {
      try {
        const rangeMin = Math.min(matchedTask.priority, targetPriority);
        const rangeMax = Math.max(matchedTask.priority, targetPriority);

        // If targetPriority > currentPriority, decrease all other tasks within the range
        // else, increase all other tasks within the range
        const changeMultiplier = targetPriority > matchedTask.priority ? -1 : 1;

        // Filter only affected tasks (within the prio range)
        const affectedTasks = allTasks.filter(
          ({ priority }) => priority >= rangeMin && priority <= rangeMax
        );

        // Update all affected tasks
        await Promise.all(
          affectedTasks.map((_task) =>
            _task.update({
              priority:
                _task.id === task
                  ? targetPriority
                  : _task.priority + changeMultiplier,
            })
          )
        );

        // Send response
        res.status(200).json({
          success: true,
        });
      } catch (err) {
        res.status(500).json({
          error: err.message,
        });
      }
    } else {
      res.status(404).json({
        error: `No task with ID ${task} was found.`,
      });
    }
  }

  static async trigger(req, res) {
    try {
      let taskId = req.body.taskID;
      let action = req.body.action;
      let position = req.body.position;
      if (!taskId || !action) {
        return res.status(500).json({
          success: "false",
          msg: "taskID or action is missing",
        });
      }
      const scheduledTask = ScheduledTasks.getInstance();
      switch (action) {
        case "start":
          await scheduledTask.init();
          // await scheduledTask.start(taskId);
          scheduledTask.parallel = true;
          scheduledTask.runCommand(action, taskId, false);
          break;
        case "stop":
          // await scheduledTask.init();

          if (position !== null && position >= 0) {
            console.log("Inside if contion in stop case");
            await scheduledTask.stop(taskId, position);
          } else {
            console.log("Else condition triggered in triggerTaskAPI");
            await scheduledTask.stop(taskId);
          }

          break;
        default:
          console.log("Action does not match, action :", action);
      }
      return res.status(200).json({
        sucess: "true",
        msg: "API Call Successfull, Scraping initiated in background",
      });
    } catch (e) {
      console.log(e);
      return res.status(500).json({
        success: "false",
        msg: e.msg,
      });
    }
  }

  static async logs(req, res) {
    const { task: taskID, after: afterTimestamp } = req.query;

    let success = false,
      status = 404,
      message = "",
      error = `No task with ID ${taskID} was found.`,
      data = null;

    if (!taskID) {
      status = 400;
      error = `Missing required parameter: task`;
    } else {
      const tasks = await Task.getAll();
      const matchedTask = tasks.find(({ id }) => id === taskID);

      if (matchedTask) {
        status = 200;
        error = "";

        try {
          const logs = await matchedTask.getLogs(Number(afterTimestamp));

          data = {
            name: matchedTask.name,
            logs,
          };
        } catch (err) {
          console.error(err);
          status = 500;
          error = err.message;
        }
      }
    }

    return res.status(status).json({
      success,
      error,
      message,
      data,
    });
  }
}

module.exports = TaskController;
