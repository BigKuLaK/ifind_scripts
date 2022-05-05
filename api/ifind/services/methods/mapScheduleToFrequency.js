const { frequencies } = appRequire('scheduled-tasks/config');

const msIntervals = {
  days: 1000 * 60 * 60 * 24,
  hours: 1000 * 60 * 60,
  minutes: 1000 * 60,
  seconds: 1000,
};

module.exports = (scheduleMs) => {
  for ( let frequency in frequencies ) {
    if ( scheduleMs === frequencies[frequency] ) {
      return frequency;
    }
  }

  // Custom frequency
  for ( let intervalName in msIntervals ) {
    if ( scheduleMs > msIntervals[intervalName] ) {
      return [
        (scheduleMs / msIntervals[intervalName]).toFixed(2),
        intervalName
      ].join(' ');
    }
  }

  return null;
};
