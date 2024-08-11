import { colors } from "consola/utils";
import type { ActionLoggerLevels } from "./logger";

export const BASE_CONTEXT = { inputs: null };
export const INTIAL_SCHEMA_IDX = -1;
export const INTIAL_SCHEMA = null;
export const INITIAL_MIDDLEWARE_STACK = [];
export const DEFAULT_ERROR_MAP = {
  "internal-server-error": "server has encountered an error",
};

// logging related constants
export const BRANCH_DELIMITER = colors.bold(colors.blue("->"));
export const COMMON_DELIMITER = colors.yellow(">");
export const DEFAULT_ROUTER_NAME = "root:router";
export const DEFAULT_MIDDLEWARE_NAME = "use:unamed";
export const DEFAULT_ACTION_HANDLER_NAME = "run:unnamed";
export const DEFAULT_LOGGING_LEVELS: ActionLoggerLevels = [
  { level: "error" },
  { level: "warn" },
  { level: "info" },
];
