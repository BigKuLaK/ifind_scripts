module.exports = {
  task: {
    table: 'tasks',
    name: 'task',
    fields: [
      { name: 'id' },
      { name: 'name' },
      { name: 'schedule' },
      { name: 'next_run' },
      { name: 'status' },
      { name: 'last_run' },
      { name: 'timeout_minutes' },
      { name: 'meta' }, // Miscellaneous data for a task
    ],
  },
};
