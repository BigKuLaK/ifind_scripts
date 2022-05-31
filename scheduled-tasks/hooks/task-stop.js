/**
 * Fires when a task is stopped.
 * e.g, when process is exitted/killed
 */
const START = "start";
const STOP = "stop";
require("colors");
const path = require("path");
const childProcess = require("child_process");
const Hook = require("../lib/Hook");
const Logger = require("../lib/Logger");
const { head } = require("request");
// const FE_ROOT = path.resolve(__dirname, "../../../web");
// const prerender_script = path.resolve(FE_ROOT, "scripts/prerender.js");

let ReceivedLogs = null;
const axios = require('axios').default;
const endpoint = "https://www.ifindilu.de/graphql";
const headers = {
  "content-type": "application/json",
};
const graphqlQuery = {
  "query": `
  mutation Prerenderer($command:PRERENDERER_COMMAND!) {
    prerenderer( command: $command )
  }
  `,
  "variables": {
    "command": START
  }
}

const getLogs = async() => {
  let graphqlQuery = {
    "query" : `{prerendererLogs {
      type
      date_time
      message
    }}`
  }
  const res = await axios({
    url:endpoint,
    method: 'POST',
    headers : headers,
    data : graphqlQuery
  })
  // console.log("res--->", res);
  ReceivedLogs = res.data.data.prerendererLogs;
  console.log("ReceivedLogs--->", ReceivedLogs);
}
class TaskStopHook extends Hook {
  static async start(taskID) {
    console.log("Called Hook ", taskID, "calling prerendering now.");
    console.log("Running Prerender...".cyan.bold);
    // console.log("Stopped : Awaited Prerender graphql endpoints");
    // await new Promise( async(resolve, reject) => {
    // Just inherit prerender's stdio (console log/error/info etc.)
    // const prerenderProcess = childProcess.fork(prerender_script, [], {
    //   stdio: "inherit",
    //   cwd: FE_ROOT,
    // });

    // Catch prerenderer error
    // prerenderProcess.on("error", (err) => {
    //   reject(err);
    // });

    // On prerender exit
    // prerenderProcess.on("exit", resolve);

    console.log("calling graphql endpoints to trigger prerender in main server");
    try {
      const response = await axios({
        url: endpoint,
        method: 'POST',
        headers: headers,
        data: graphqlQuery
      })
      console.log("Response of graphql endpoint triggereing prerendering : ", response.status);
      await getLogs();
      if(ReceivedLogs != null){
        for(const i in ReceivedLogs){
          console.log("Log values ->", i);
          Logger.log(i);
        }
      }
      console.log("Prerender logs added into logger");
    } catch (e) {
      console.log("Error : ", e);
    }
    
    // resolve;
    // });
  }
}

TaskStopHook.init();
