import "server-only";

import {
  DEFAULT_ACTION_HANDLER_NAME,
  DEFAULT_LOGGING_LEVELS,
  DEFAULT_MIDDLEWARE_NAME,
  DEFAULT_ROUTER_NAME,
  INITIAL_MIDDLEWARE_STACK,
  INTIAL_SCHEMA,
  INTIAL_SCHEMA_IDX,
} from "./constants";
import { ActionPath } from "./path";
import { ActionLogger, type ActionLoggerLevels } from "./logger";
import { createMiddleware } from "./middleware";
import { ActionError, InternalError, UnHandledError } from "./errors";
import { createActionHandler } from "./handler";

import { colors } from "consola/utils";
import { z, ZodTypeAny, type ZodSchema } from "zod";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { isNotFoundError } from "next/dist/client/components/not-found";
import { getActionTraceString } from "./utils";

// #region Types
// type utils
type ReplaceKeyValue<T extends {}, K extends keyof T, V> = Omit<T, K> &
  Record<K, V>;

type NextCookies = ReturnType<typeof cookies>;
type NextHeaders = ReturnType<typeof headers>;

/**
 * `ActionRequest` contains request related information
 * like `context`, `cookies` and `headers`.
 */
type ActionRequest<TContext> = {
  context: TContext;
  headers: NextHeaders;
  cookies: NextCookies;
};

/**
 * `schema` of a successful response of an action call.
 */
type ActionSuccessResponse<TData> = {
  success: true;
  data: TData;
};

/**
 * `schema` of a error response of an action call.
 */
type ActionErrorResponse<TCode> = {
  success: false;
  error: {
    code: TCode;
    message: string;
  };
};

/**
 * `ActionResponse` object is a collection of helper methods.
 */
type ActionResponse<TErrorCodes> = {
  /**
   * @returns formatted(JSON) data response
   */
  data: <TData>(data: TData) => ActionSuccessResponse<TData>;
  /**
   * @returns formatted(JSON) error response
   */
  error: <TCode extends TErrorCodes>(
    code: TCode,
    message?: string
  ) => ActionErrorResponse<TCode>;
  /**
   * @returns Helper to create error with new code just in time.
   */
  createError: <T extends string>(
    code: T,
    message: string
  ) => ActionErrorResponse<T>;
  /**
   * @see {redirect}
   */
  redirect: typeof redirect;
  /**
   * @see {notFound}
   */
  notFound: typeof notFound;
};

/**
 * Read more: Docs: [`Middlewares`](https://next-action-router.netlify.app/concepts/middlewares)
 */
type ActionMiddleware<TContext, TErrorCodes, TReturn> = (
  request: ActionRequest<TContext>,
  {} // write here
) => Promise<TReturn>;

type ActionMiddlewareOptions = {
  name: string;
};
/**
 * Read more: Docs: [`Action Handler`](https://next-action-router.netlify.app/concepts/action-handler)
 */
type ActionHandler<TContext, TErrorCodes extends PropertyKey, TReturn> = (
  request: ActionRequest<TContext>,
  response: ActionResponse<TErrorCodes>
) => Promise<TReturn>;

type ActionHandlerOptions = {
  name: string;
};

type ActionRouterConfig<TErrorCodes extends Record<string, string>> = {
  /**
   * Name of a router instance (optional)
   * @default "root"
   */
  name?: string | "root";
  logging?: ActionLoggerLevels;
  error: {
    codes: TErrorCodes;
  };
};

type InputReturnType<
  TContext extends { inputs: any },
  TErrorCodes extends Record<string, string>,
  T extends ZodTypeAny,
> = Omit<
  ActionRouter<
    TErrorCodes,
    ReplaceKeyValue<TContext, "inputs", Readonly<z.infer<T>>>
  >,
  "input" | "branch"
>;
// #endregion Types end

// #region Implementation
export class ActionRouter<
  TErrorCodes extends Record<string, string> = {},
  TContext extends { inputs: any } = { inputs: void },
> {
  /**
   * @private This is a private property. Do not touch this!
   */
  _internals: {
    middlewares: Array<any>;
    schema: ZodSchema<any> | null;
    schemaIdx: number;
    path: ActionPath;
    log: ActionLogger;
  };
  /**
   * @private This is a private property. Do not touch this!
   */
  private _config: ActionRouterConfig<TErrorCodes>;

  constructor(
    config: ActionRouterConfig<TErrorCodes> = { error: { codes: {} as any } }
  ) {
    this._config = config;

    // setting config defaults
    const {
      name = DEFAULT_ROUTER_NAME,
      logging: levels = DEFAULT_LOGGING_LEVELS,
    } = this._config;

    // setting internal state defaults
    this._internals = {
      middlewares: INITIAL_MIDDLEWARE_STACK,
      schema: INTIAL_SCHEMA,
      schemaIdx: INTIAL_SCHEMA_IDX,
      path: new ActionPath(name),
      log: new ActionLogger(levels),
    };
  }

  /**
   * Registers an action middleware.
   *
   * Read more: Docs: [`Input Validation`](https://next-action-router.netlify.app/concepts/middlewares)
   */
  use<TReturn extends { inputs: any } = { inputs: null }>(
    middleware: ActionMiddleware<TContext, TErrorCodes, TReturn>,
    options: ActionMiddlewareOptions = { name: DEFAULT_MIDDLEWARE_NAME }
  ): ActionRouter<TErrorCodes, TReturn> {
    this.path.push("common", options.name);
    this.middlewares.push(createMiddleware(middleware, this.path.clone()));
    this._internals.log.info(
      `Action middleware registered by name ${options.name} on path: ${this.path.toString()}`
    );
    return this as any;
  }

  /**
   * Registers a zod schema for input validation.
   * Should only be called in the last branch means the
   * branch where you're going to call `run` method and
   * export your server action
   *
   * Read more: Docs: [`Input Validation`](https://next-action-router.netlify.app/concepts/input-validation)
   */
  input<T extends ZodTypeAny>(
    schema: T
  ): InputReturnType<TContext, TErrorCodes, T> {
    if (this.schema) {
      throw Error(
        "Only one input call is allowed in a single action router chain."
      );
    }
    this._internals.schema = schema;
    this._internals.schemaIdx = this.middlewares.length;
    this._internals.log.info(`Action input on path: ${this.path.toString()}`);
    return this as any;
  }

  /**
   * @returns final context for action handler
   */
  private async executeMiddlewareStack(
    params: TContext["inputs"],
    cookies: NextCookies,
    headers: NextHeaders
  ): Promise<TContext> {
    const { schema, schemaIdx } = this._internals;
    const middlewares = this.middlewares;

    // only if schema exists
    const hasSchema = !!schema;
    const shouldValidateIntially = schemaIdx === 0;

    // flag to keep track if inputs are already verified
    // during the execution of the middlewares
    let hasValidated = false;
    let initialInput = null;

    // validate inputs if schema is registered before all the middlewares
    if (hasSchema && shouldValidateIntially) {
      initialInput = await schema?.parseAsync(params);
      hasValidated = true;
    }

    // starting out with the initial context
    let context: any = { inputs: initialInput };
    for (let i = 0; i < middlewares.length; ++i) {
      if (hasSchema && !hasValidated && i === schemaIdx) {
        context["inputs"] = await this.schema?.parseAsync(params);
      }
      const middleware = middlewares[i];

      this.log.debug(colors.bgBlue("Input Context "), context);

      // each middleware gets the output of the last middleware
      // as input context through args
      context = await middleware({ context, cookies, headers });
    }

    // if input schema is registered and directly `run` is called
    // then also we need validated inputs
    if (hasSchema && !hasValidated && schemaIdx >= middlewares.length) {
      context["inputs"] = await schema?.parseAsync(params);
    }
    return context;
  }

  /**
   * Register an action handler function.
   *
   * Read more: Docs: [`run`](https://next-action-router.netlify.app/concepts/action-handler)
   */
  run<TReturn>(
    handler: ActionHandler<TContext, keyof TErrorCodes, TReturn>,
    options: ActionHandlerOptions = { name: DEFAULT_ACTION_HANDLER_NAME }
  ) {
    this.path.push("common", options.name);

    //  shared response helper object
    const actionResponse: ActionResponse<keyof TErrorCodes> = {
      data: (payload) => ({ success: true, data: payload }),
      error: (code, message) => ({
        success: false,
        error: {
          code,
          message: message ?? (this._config.error.codes[code] as any),
        },
      }),
      createError: (code, message) => ({
        success: false,
        error: {
          code,
          message,
        },
      }),
      redirect,
      notFound,
    };

    return async (params: TContext["inputs"]) => {
      try {
        const nextHeaders = headers();
        const nextCookies = cookies();
        const context = await this.executeMiddlewareStack(
          params,
          nextCookies,
          nextHeaders
        );

        // unique request object
        const actionRequest: ActionRequest<TContext> = {
          context,
          cookies: nextCookies,
          headers: nextHeaders,
        };

        this.log.debug(colors.bgBlue("Input Context "), "\n", context);

        const wrappedHandler = createActionHandler(handler, this.path.clone());
        return await wrappedHandler(actionRequest, actionResponse);
      } catch (err) {
        if (isRedirectError(err) || isNotFoundError(err)) {
          throw err;
        }

        // explicitly thrown errors by devs
        if (err instanceof ActionError) {
          return actionResponse.error(err.code, err.message);
        }

        if (err instanceof UnHandledError) {
          this._internals.log.error(err);
          // fallback to internal server error
        }

        if (err instanceof InternalError) {
          this._internals.log.error(err);
        } else {
          this._internals.log.error(new InternalError(err));
        }

        return actionResponse.createError(
          "internal-server-error",
          "server has encountered an error"
        );
      }
    };
  }

  /**
   * This function creates a new branch in action routing tree.
   * Call this when you need a new sub action router or
   * you need to end the branch to create a exportable server action.
   *
   * Read more: Docs: [`branch` usage](https://next-action-router.netlify.app/concepts/middlewares#middleware-levels)
   */
  branch(): this {
    // step-1: create a new router instance
    const branch = new ActionRouter(this._config);

    // step-2: copy all the internal state
    branch._config = this._config;
    branch._internals = {
      middlewares: [...this.middlewares],
      schema: this.schema,
      schemaIdx: this._internals.schemaIdx,
      path: this.path.clone().push("branch"),
      log: this.log,
    };

    this._internals.log.info(
      `Branching off from the path ${this.path.toString()}`
    );
    return branch as any;
  }

  private get middlewares() {
    return this._internals.middlewares;
  }

  private get schema() {
    return this._internals.schema;
  }

  private get log() {
    return this._internals.log;
  }

  private get path() {
    return this._internals.path;
  }
}
// #endregion Implementaion end
