declare interface TaskEntity {
  computeNextRun: () => void;
  start: () => void;
  stop: () => void;
  getLogs: () => void;
}
