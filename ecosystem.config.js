module.exports = {
  apps: [
    {
      name: "scripts-server",
      script: "npm",
      args: "start",
      watch: false,
      max_memory_restart: "200M",
    },
  ],
};
