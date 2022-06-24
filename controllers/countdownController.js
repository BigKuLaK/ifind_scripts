const ScheduledTasks = require('../scheduled-tasks');

exports.updateCountdownAPI = async(req,res) =>{
  try{
    console.log("Inside updateCountdownAPI API ", req.body);
    let id = req.body.taskID;
    let minutes = req.body.minutes;
    if(!id || minutes < 0){
      return res.status(500).json({
        success : "false",
        msg : "taskId or frequency is missing"
      })
    }    
    // Code to update the countdown
    const scheduledTask = ScheduledTasks.getInstance();
    let countdown = 1000 * minutes * 60
    const countdownTime = scheduledTask.schedule(id,countdown)
    scheduledTask.callUpdateCountdown(id);
    const list = scheduledTask.list()

    return res.status(200).json({
      sucess:"true",
      msg : "Limit Updated Successfully",
      countdownTime: list
    })
  }catch(e){
      console.log(e);
      return res.status(500).json({
          success:"false",
          msg : e.msg
      })
  }
}