const path = require("path");
const chokidar = require("chokidar");
const { fork } = require("child_process");
const { debounce } = require("underscore");

const binPath = path.resolve(__dirname, "../bin/www");

let isWatching = false;
let currentProcess;

const watchApp = () => {
  isWatching = true;

  const paths = [
    path.resolve(
      __dirname,
      "../{controllers,helpers,routes,scheduled-tasks,config}/**/*.js"
    ),
    path.resolve(__dirname, "../app.js"),
  ];

  const watcher = chokidar.watch(paths, {
    usePolling: true,
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on(
    "all",
    debounce((event, path) => {
      if (/change|unlink/.test(event) && currentProcess) {
        console.info(`Change detected on ${path}. Restarting server.`);
        createAppProcess();
      }
    }, 300)
  );

  console.info("Watching files for changes.");
};

const createAppProcess = async () => {
  // Ensure there's only a single forked process
  if (currentProcess?.running) {
    await new Promise((resolve) => {
      currentProcess.on("exit", () => resolve);
      currentProcess.kill("SIGTERM");
    });
  }

  const appProcess = fork(binPath, [], {
    stdio: "inherit",
    env: process.env,
  });

  appProcess.running = true;
  currentProcess = appProcess;

  appProcess.on("message", (data) => {
    if (data === "init" && !isWatching) {
      watchApp();
    }
  });

  appProcess.on("exit", (exitCode) => {
    appProcess.running = false;

    // Restart server on non-error exit code
    if (!exitCode) {
      createAppProcess();
    }
  });
};

createAppProcess();
