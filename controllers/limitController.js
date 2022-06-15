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

exports.updateParalleltyAPI = async(req,res) =>{
  try{
    console.log("Inside updateParallel API ", req.body);
    let parallel = req.body.parallel ;
    if(!parallel || isNaN(parallel)){
      return res.status(500).json({
        success : "false",
        msg : "Parallel is missing or invalid value"
      })
    }    
    // Code to update the limit
    const scheduledTask = ScheduledTasks.getInstance();
    if(!isNaN(parallel) ){
        console.log("Parallel Value -->",parallel);
        console.log("updating Execution queue Parallel")
        ScheduledTasks.PARALLELLIMIT = parallel;
        console.log("Parallel Value After Update-->",ScheduledTasks.PARALLELLIMIT);
    }
    return res.status(200).json({
      sucess:"true",
      msg : "Parallelity Updated Successfully"
    })
  }catch(e){
      console.log(e);
      return res.status(500).json({
          success:"false",
          msg : e.msg
      })
  }
}