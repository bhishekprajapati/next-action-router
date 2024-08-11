export class BaseError extends Error {
  path: string;
  originalError: Error;

  constructor(originalError: unknown, path: string = "") {
    super(undefined);
    this.path = path;
    if (originalError instanceof Error) {
      this.originalError = originalError;
    } else if (typeof originalError === "string") {
      this.originalError = new Error(originalError);
    } else {
      this.originalError = new Error("Something went wrong");
    }
    this.name = this.originalError.name;
    this.message = this.originalError.message;
    this.stack = this.originalError.stack;
    Object.setPrototypeOf(this, BaseError.prototype);
  }
}

/**
 * This represents the type of errors which are coming from
 * the library's internal implementation.
 */
export class InternalError extends BaseError {}

type UnHandledErrorTypes = "MiddlewareError" | "ActionHandlerError";
/**
 * To represent unhandled errors in the users/developers code.
 */
export class UnHandledError extends BaseError {
  type: UnHandledErrorTypes;

  constructor(type: UnHandledErrorTypes, path: string, originalError: unknown) {
    super(originalError, path);
    this.type = type;
    Object.setPrototypeOf(this, UnHandledError.prototype);
  }
}

/**
 * To represent errors that are explicitly thrown by developers.
 */
export class ActionError<TErrorCodes extends string> extends Error {
  constructor(
    public code: TErrorCodes,
    message: string = ""
  ) {
    super(message);
    Object.setPrototypeOf(this, ActionError.prototype);
  }
}

export class ValidationError extends Error {
  constructor(message: string = "") {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
