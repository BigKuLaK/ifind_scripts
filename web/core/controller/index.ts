import { Application } from "express";
import Model from "@web/core/model";

export default abstract class Controller {
  // Model name in PascalCase
  model?: string;

  // Route name in kebab-case, without leading/trailing slash
  route?: string;

  routePaths?: ControllerRoutePaths;

  constructor(public expressApp: Application) {}

  init() {
    if (this.route) {
      // Generate route paths
      this.routePaths = {
        get: {
          index: `/${this.route}`,
          find: `/${this.route}/:id`,
        },
      };
    }

    // Attach routes to methods
    this.attachRoutes();
  }

  /**
   * Resolves index route
   * Returns a list of entities as a response payload
   */
  async index(request: Request): Promise<ControllerIndexPayload> {
    // Query items
    const items = await this.findAll(request);

    // Return serializeable data
    return { items };
  }

  /**
   * Resolves get route
   * Returns an entity
   */
  async get(request: Request): Promise<ControllerGetPayload> {
    //  Query item
    const item = await this.find(request);

    // Return serializeable data
    return { item };
  }

  /**
   * Queries and returns entities list
   * @returns Model[]
   */
  async findAll(request: Request): Promise<Model[]> {
    return [];
  }

  /**
   * Queries a single entity
   * @returns Model
   */
  async find(request: Request): Promise<Model | null> {
    return null;
  }

  /**
   * Adds route configurations into the provided Express app instance
   */
  attachRoutes() {
    // Loop through the defined route-method map
    // See: this.init

    // Attach GET routes
    if (this.route && this.routePaths?.get) {
      Object.entries(this.routePaths.get).forEach(
        ([routeMethod, routePath]) => {
          if (routePath && routeMethod in this) {
            console.log(`Attaching route: ${routePath}`);
            this.expressApp.get(routePath as string, async (req, res) => {
              try {
                // Call route method, passing Express.Request
                const data = await (this as GenericObject)[routeMethod].call(
                  this,
                  req
                );
                res.json(data);
              } catch (err: any) {
                // Return error message as a json response
                res.json({
                  error: err.message,
                });
              }
            });
          }
        }
      );
    }
  }
}
