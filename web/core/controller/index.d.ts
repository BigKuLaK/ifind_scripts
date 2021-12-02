import Model from '../model';

declare type ControllerRouteMethods = "index" | "get";

declare type ControllerWhereParameterMatchExact =
  | string
  | number
  | null
  | Array<string | number | null>;

declare type ControllerWhereParameterMatchConditions =
  | "not"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "text_contains"
  | "text_contains_s";

declare interface ControllerWhereParameterMatchConditionalMatch {
  [
    key: ControllerWhereParameterMatchConditions
  ]: ControllerWhereParameterMatchExact;
}

declare interface ControllerWhereParameters {
  [key: string]:
    | ControllerWhereParameterMatchExact
    | ControllerWhereParameterMatchConditionalMatch;
}

declare interface ControllerIndexParameters {
  limit?: number;
  offset?: number;
}

declare interface ControllerIndexPayload {
  items: Model[];
}

declare interface ControllerGetParameters {
  id?: string | number;
  where: ControllerWhereParameters;
}

declare interface ControllerGetPayload {
  item: Model;
}

declare type ControllerRoutePaths = {
  get?: Record<ControllerRouteMethods, string>;
  post?: Record<ControllerRouteMethods, string>;
}
