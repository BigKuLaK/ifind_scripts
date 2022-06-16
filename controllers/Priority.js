const ScheduledTasks = require('../scheduled-tasks');

exports.updatePriorityAPI = async(req,res) =>{
  try{
    console.log("Inside updateCountdownAPI API ", req.body);
    let id = req.body.taskID;
    let priority = req.body.priority;
    if(!id || !priority){
      return res.status(500).json({
        success : "false",
        msg : "taskId or frequency is missing"
      })
    }    
    // Code to update the countdown
    const scheduledTask = ScheduledTasks.getInstance();
    const updatePriority = scheduledTask.priority(id,priority)
    const list = scheduledTask.list()

    return res.status(200).json({
      sucess:"true",
      msg : "Limit Updated Successfully",
      priority: list
    })
  }catch(e){
      console.log(e);
      return res.status(500).json({
          success:"false",
          msg : e.msg
      })
  }
}