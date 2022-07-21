module.exports = `
  enum TASK_STATUS {
    START
    STOP
    ERROR
  }

  enum SCHEDULED_TASK_NAME {
    product_validator
  }

  enum SCHEDULED_TASK_STATUS {
    stopped
    running
  }

  type TaskLogEntry {
    date_time: String
    type: String
    message: String
  }

  type Task {
    name: String!
    status: TASK_STATUS
    logs: [TaskLogEntry]
    canRun: Boolean
  }

  type ScheduledTask {
    id: String
    name: String
    status: SCHEDULED_TASK_STATUS
    frequency: String
    next_run: Float
    countdown: String
    last_run: Float

    # Computed values
    hasModule: Boolean
    canRun: Boolean
  }

  enum SCHEDULED_TASK_ACTION {
    start
    stop
  }

  type ScheduledTaskPayload {
    error: String
    data: [ScheduledTask]
  }

  type ScheduledTaskListPayload {
    serverTimeUnix: String
    serverTimeFormatted: String
    tasks: [ScheduledTask]
    logs: [TaskLogEntry]
  }
`;
