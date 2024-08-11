import { colors } from "consola/utils";
import type { ActionPath } from "./path";
import { ActionError, UnHandledError } from "./errors";

export const createActionHandler = <R>(
  fn: (...args: any[]) => Promise<R>,
  actionPath: ActionPath
) => {
  return async (...args: Parameters<typeof fn>) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ActionError) {
        throw err;
      } else {
        throw new UnHandledError(
          "ActionHandlerError",
          actionPath.toString(({ isLast, name }) =>
            isLast ? colors.underline(colors.red(name)) : name
          ),
          err
        );
      }
    }
  };
};
