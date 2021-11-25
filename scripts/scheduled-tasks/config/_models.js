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
    ],
  },
};
