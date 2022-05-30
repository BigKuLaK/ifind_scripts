const ScheduledTasks = require('../scheduled-tasks');

exports.taskLogAPI = async(req,res) =>{
  try{
    console.log("Inside TriggerTask API ", req.body);
    let taskId = req.body.taskID ;
    if(!taskId){
      return res.status(500).json({
        success : "false",
        msg : "taskID or action is missing"
      })
    }
    const scheduledTask = ScheduledTasks.getInstance();
    const taskLogs = scheduledTask.getTask(taskId);
    // console.log("taskLogs", taskLogs.logs);
    return res.status(200).json({
      sucess:"true",
      logs : taskLogs.logs,
      name : taskLogs.name
    })
  }catch(e){
      console.log(e);
      return res.status(500).json({
          success:"false",
          msg : e.msg
      })
  }
}