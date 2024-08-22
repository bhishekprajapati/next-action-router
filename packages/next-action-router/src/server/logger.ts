import { createConsola, LogType } from "consola";
import { colors } from "consola/utils";
import { Union } from "ts-toolbelt";

import { BRANCH_DELIMITER, COMMON_DELIMITER } from "./constants";
import { InternalError, UnHandledError } from "./errors";

const consola = createConsola({
  level: 999,
});

const actionPathSymbolHelp = () => `
Symbol Meaning:
[${BRANCH_DELIMITER}] Branch diversion
[${COMMON_DELIMITER}] Common path flow
`;

const formatTags = (...tags: string[]) =>
  colors.bold(tags.map((tag) => `[${tag}]`).join(" "));

const formatErrorMessage = (tags: string[] = [], message = "", path = "") =>
  `${formatTags(...tags)}: ${message} \n\n${colors.bgRed(" ActionPath ")} ${path} \n${actionPathSymbolHelp()}`;

export type ActionLogType = "info" | "error" | "warn" | "debug";
export type ActionLoggerLevels = Array<{ level: ActionLogType }>;

export class ActionLogger {
  private pkgName = "next-action-router";
  public flags: Record<`is${Capitalize<ActionLogType>}Active`, boolean>;

  constructor(private levels: ActionLoggerLevels) {
    this.flags = {
      isWarnActive: false,
      isInfoActive: false,
      isErrorActive: false,
      isDebugActive: false,
    };

    levels.forEach(({ level }) => {
      switch (level) {
        case "error":
          this.flags.isErrorActive = true;
          break;
        case "info":
          this.flags.isInfoActive = true;
          break;
        case "warn":
          this.flags.isWarnActive = true;
          break;
        case "debug":
          this.flags.isDebugActive = true;
          break;
      }
    });
  }

  info(...args: Parameters<typeof consola.info>) {
    this.flags.isInfoActive && consola.info(...args);
  }

  warn(...args: Parameters<typeof consola.warn>) {
    this.flags.isWarnActive && consola.warn(...args);
  }

  debug(...args: Parameters<typeof consola.debug>) {
    this.flags.isDebugActive && consola.debug(...args);
  }

  log(...args: Parameters<typeof consola.log>) {
    consola.log(...args);
  }

  error(err: InternalError | UnHandledError) {
    if (!this.flags.isErrorActive) return;

    if (err instanceof InternalError) {
      err.message = formatErrorMessage(
        [this.pkgName, "InternalError"],
        err.message,
        err.path,
      );
      consola.error(err);
      consola.warn(
        colors.bold(
          colors.yellow(
            "This is more likely a next-action-router's internal error. Please create a issue at https://github.com/bhishekprajapati/next-action-router",
          ),
        ),
      );
      return;
    }

    if (err instanceof UnHandledError) {
      err.message = formatErrorMessage(
        [this.pkgName, "UnhandledError", err.type],
        err.message,
        err.path,
      );

      consola.error(err);
      return;
    }
  }
}
