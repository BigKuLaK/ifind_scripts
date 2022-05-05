const moment = require("moment");

module.exports = {
  query: `
    getTask ( id: String! ): Task
    scheduledTasksList: ScheduledTaskListPayload
    sheduledTasks ( command: String, id: String ): ScheduledTaskPayload
  `,
  mutation: `
    triggerTask ( taskID: String, action: SCHEDULED_TASK_ACTION ): ScheduledTaskListPayload
  `,
  resolveQuery: {
    async sheduledTasks(_, { command, id }) {
      const tasks = strapi.scheduledTasks.runCommand(command, id);
      return { tasks };
    },
    async scheduledTasksList() {
      const serverTime = moment.utc();
      const serverTimeUnix = String(serverTime.valueOf());
      const serverTimeFormatted = serverTime.format("YYYY-MMM-DD HH:mm:ss");
      const tasks = strapi.scheduledTasks.list();
      const logs = strapi.scheduledTasks.getLogs();

      return { serverTimeUnix, serverTimeFormatted, tasks, logs };
    },
    async getTask(_, { id }) {
      return strapi.scheduledTasks.getTask(id);
    },
  },
  resolveMutation: {
    async triggerTask(_, args) {
      const { action: command, taskID: id } = args;
      const tasks = strapi.scheduledTasks.runCommand(command, id);
      return { tasks };
    },
  },
};
