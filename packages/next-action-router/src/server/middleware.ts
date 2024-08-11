import { colors } from "consola/utils";
import type { ActionPath } from "./path";
import { ActionError, UnHandledError } from "./errors";

export const createMiddleware = (
  fn: (...args: any[]) => Promise<any>,
  actionPath: ActionPath
) => {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      // In this block, we are checking if
      // the caller has handled the errors or not

      // if true means caller has already handled the error
      if (err instanceof ActionError) {
        throw err;
      } else {
        throw new UnHandledError(
          "MiddlewareError",
          actionPath.toString(({ isLast, name }) =>
            isLast ? colors.underline(colors.red(name)) : name
          ),
          err
        );
      }
    }
  };
};
