const ScheduledTasks = require('../scheduled-tasks');

exports.updateLimitAPI = async(req,res) =>{
  try{
    console.log("Inside updateLimit API ", req.body);
    let limit = req.body.limit ;
    if(!limit || isNaN(limit)){
      return res.status(500).json({
        success : "false",
        msg : "Limit is missing or invalid value"
      })
    }    
    // Code to update the limit
    const scheduledTask = ScheduledTasks.getInstance();
    if(!isNaN(limit) ){
        console.log("Limit Value -->",limit);
        console.log("updating Execution queue Limit")
        ScheduledTasks.LIMIT = limit;
        console.log("Limit Value After Update-->",ScheduledTasks.LIMIT);
    }
    return res.status(200).json({
      sucess:"true",
      msg : "Limit Updated Successfully"
    })
  }catch(e){
      console.log(e);
      return res.status(500).json({
          success:"false",
          msg : e.msg
      })
  }
}