import type { BaseErrorMap, DefaultRouterName } from "./constants";
import type { ActionLoggerLevels } from "./logger";

export type ActionRouterConfig<TErrorCode extends string> = {
  /**
   * Name of a router instance (optional)
   */
  name?: string | DefaultRouterName;
  logging?: ActionLoggerLevels;
  error?: {
    codes: Record<TErrorCode, string> & Partial<BaseErrorMap>;
  };
};
