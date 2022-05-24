const ScheduledTasks = require('../scheduled-tasks');

exports.taskControllerApi = async (req, res) => {
    try {
        console.log("Inside Task Controller API");
        const scheduledTask = new ScheduledTasks;
        // const task = require('../scheduled-tasks/config/_tasks');
        const task = scheduledTask.listWithCountdown();
        console.log("tasks : ", task);
        return res.status(200).json({
            success: "True",
            tasks: task
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
