const PRODUCTION_ENV = require("dotenv").config().parsed;

module.exports = {
  apps: [
    {
      name: "scripts-server",
      script: "./bin/www",
      args: "start",
      watch: false,
      max_memory_restart: "200M",
      env: process.env.ENV === "development" ? process.env : PRODUCTION_ENV,
    },
  ],
};
