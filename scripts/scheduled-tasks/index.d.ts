declare namespace ScheduledTasks {
  interface Model {
    update: (args: any) => any;
    create: (args: any) => any;
  }
}

declare interface TaskData {
  // Data
  id: string;
  name: string;
  schedule: number;
  next_run: number;
  frequency?: number;
}

declare interface TaskEntity  extends ScheduledTasks.Model, TaskData {
  computeNextRun: () => void;
  start: () => void;
  stop: () => void;
  getLogs: () => void;
}
