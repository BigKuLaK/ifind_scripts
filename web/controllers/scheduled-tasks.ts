import Controller from "@web/core/controller";
import { Application } from "express";

export default class ScheduledTasksController extends Controller {
  model = "ScheduledTasks";

  route = "scheduled-tasks";

  constructor(app: Application) {
    super(app);
  }

  async findAll() {
    return ["test123", 456];
  }

  async find() {
    return { test: 123 };
  }
}
