const ScheduledTasks = require('../scheduled-tasks');
const scheduledTask = new ScheduledTasks;

exports.taskControllerApi = async (req, res) => {
    try {
        const tasks = await scheduledTask.init();
        const taskList = scheduledTask.list();
        // console.log("typeof  : ",taskList);
        return res.status(200).json({
          success: "True",
          tasks: taskList
          })
    }
    catch (e) {
        console.log("error", e);
        console.log("error message", e.msg);
        return res.status(500).json({
            success: "false",
            msg: e.msg
        })
    }
};
