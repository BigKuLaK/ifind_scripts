const { getValueDeals } = require("../helpers/aliexpress/value-deals");
const { getDetailsFromURL } = require("../helpers/aliexpress/api");

const ScheduledTasks = require('../scheduled-tasks');

// API to scrape data and perform corresponding functions 
exports.aliExpressApi = async (req, res) => {
  try {
    console.log("Inside aliExpressApi ", req.body);
    const scheduledTask = new ScheduledTasks;
    console.log("req.body.taskId ", req.body.taskID);
    console.log("req.body.action ", req.body.action);
    let taskId = req.body.taskID ;
    let action = req.body.action ; 
    console.log("value of action ",action );
    console.log("value of taskId", taskId );

    const data = {
      id: "aliexpress-value-deals",
      name:"AliExpress Super Value Deals",
      schedule:  3600000,
      next_run:1652941800000,
      status: null,
      last_run: 1652938238107,
      timeout_minutes: 120,
      meta: {
        deal_type: "aliexpress_value_deals",
        deal_merchant: "aliexpress"
      }
    }
    switch (action){
      case 'start' :
        scheduledTask.addTask(data);
        console.log("starting task : ");
        scheduledTask.start(taskId);
      case 'stop':
        scheduledTask.stop(taskId);
      default:
          console.log("Action does not match, action :", action);
    }

    console.log(" DONE ".bgGreen.white.bold);
    return res.status(200).json({
      success: "true",
      data: finalProducts,
    })
  } catch (err) {
    console.error(err, err.data);
    throw err;
  }
};
