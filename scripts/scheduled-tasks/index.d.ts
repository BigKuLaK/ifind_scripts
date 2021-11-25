declare interface Model {
    update: GenericFunction;
    create: GenericFunction;
}

declare interface TaskData {
    // Data
    id: string;
    name: string;
    schedule: number;
    next_run: number;
    frequency?: number;
}

declare interface TaskEntity extends Model,TaskData {
    computeNextRun: () => void;
    start: () => void;
    stop: () => void;
    getLogs: () => void;
}