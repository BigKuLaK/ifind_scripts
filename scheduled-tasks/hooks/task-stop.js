/**
 * Fires when a task is stopped.
 * e.g, when process is exitted/killed
 */

require("colors");
const path = require("path");
const childProcess = require("child_process");
const Hook = require("../lib/Hook");

const FE_ROOT = path.resolve(__dirname, "../../../web");
const prerender_script = path.resolve(FE_ROOT, "scripts/prerender.js");

class TaskStopHook extends Hook {
  static async start(taskID) {
    console.log("Running Prerender...".cyan.bold);
    console.log("Stopped : Awaited Prerender graphql endpoints");
    await new Promise((resolve, reject) => {
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
      resolve;
    });
  }
}

TaskStopHook.init();
