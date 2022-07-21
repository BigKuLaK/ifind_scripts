const ScheduledTasks = require("../scheduled-tasks");
const Task = require("../scheduled-tasks/lib/Task");

class TaskController {
  // TODO: Improve this logic
  // tasks listing
  static async index(req, res) {
    try {
      const scheduledTask = ScheduledTasks.getInstance();
      scheduledTask.init();
      const taskList = scheduledTask.list();
      const logs = await scheduledTask.getLogs();
      let addedTasks = scheduledTask.getQueue();
      if (addedTasks.length !== 0) {
        let firstQueue = addedTasks[0];
        let status = firstQueue.status;
        let id = firstQueue.id;
        if (status == "stopped") {
          console.log(
            "Starting task from task.js; First task status stopped reveived"
          );
          const command = "start";
        } else {
          // Task is running
        }
      } else {
        // Queue is empty
      }

      let execution_limit = ScheduledTasks.LIMIT;
      let parallel_limit = ScheduledTasks.PARALLELLIMIT;

      return res.status(200).json({
        success: "True",
        tasks: taskList,
        logs: logs,
        isTaskAdded: addedTasks,
        limit: execution_limit,
        parallel: parallel_limit,
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
            logs
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
