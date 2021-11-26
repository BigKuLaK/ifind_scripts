import "colors";
import ScheduledTasksController from "@web/controllers/scheduled-tasks";
import { Application } from "express";

/**
 * Gets a list of controllers and initialize them
 * @param app - The express app instance
 */
export const initializeControllers = (app: Application) => {
  console.info(`Initializing controllers`.bold);

  [ScheduledTasksController].forEach((controllerClass) => {
    // Instantiate controller
    const controllerInstance = new controllerClass(app);

    // Initialize controller
    controllerInstance.init();
  });
};
