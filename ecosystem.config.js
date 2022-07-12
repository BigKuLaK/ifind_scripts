module.exports = {
  apps: [
    {
      name: "scripts-server",
      script: "./bin/www",
      args: "start",
      watch: false,
      max_memory_restart: "200M",
    },
  ],
};
