const { PORT } = require('dotenv').config().parsed;

module.exports = {
  apps: [
    {
      name: "scripts-server",
      script: "npm",
      args: "start",
      watch: false,
      max_memory_restart: "200M",
      env: { PORT }
    },
  ],
};
