const ScheduledTasks = require('../scheduled-tasks');


exports.getAmazonProducts = async (req, res) => {
  try {
    console.log("Inside getAmazonProducts", req.body);
    const scheduledTask = new ScheduledTasks;
    console.log("req.body.taskId ", req.body.taskID);
    console.log("req.body.action ", req.body.action);
    let taskId = req.body.taskID ;
    let action = req.body.action ; 
    console.log("value of action ", action );
    console.log("value of taskId ", taskId );
    
    const data = {
      id:  "amazon-lightning-offers",
      name: "Amazon Lightning Offers",
      schedule: 3600000,
      next_run: 1652940600000,
      status: null,
      last_run: 1652883034517,
      timeout_minutes: 120,
      meta: {
        deal_type :"amazon_flash_offers",
        deal_merchant : "amazon"
      }
    }
    switch (action){
      case 'start' :
        scheduledTask.addTask(data);
        console.log("starting task : ");
        scheduledTask.start(taskId);
        break;
      case 'stop':
        scheduledTask.stop(taskId);
        break;
      default:
          console.log("Action does not match, action :", action);
    }
    console.log(" API CALL DONE ".bgGreen.white.bold);
    return res.status(200).json({
      success: "true",
      msg : "api call successfull, Scraping triggered in background",
    })
  }
  catch (err) {
    console.error(err.message);
    productScraper.close();
    throw err;
  }
};
