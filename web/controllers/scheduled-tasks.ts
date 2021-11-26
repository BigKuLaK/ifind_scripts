import Controller from "@web/core/controller";
import { Application, Request } from "express";

export default class ScheduledTasksController extends Controller {
  model = "ScheduledTasks";

  route = "scheduled-tasks";

  constructor(app: Application) {
    super(app);
  }

  async findAll() {
    return ["test123", 456];
  }

  async find(req: Request) {
    // Force test error
    if (req.params.id === "error") {
      throw new Error("Some Test Error");
    }

    // Sample entity data
    return {
      id: req.params.id,
      test: 123,
    };
  }
}
