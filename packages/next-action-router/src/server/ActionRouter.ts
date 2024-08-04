import "server-only";
import { z, ZodTypeAny, type ZodSchema } from "zod";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { isNotFoundError } from "next/dist/client/components/not-found";

export const BASE_CONTEXT = { inputs: null };
export const INTIAL_SCHEMA_IDX = -1;
export const INTIAL_SCHEMA = null;
export const INITIAL_MIDDLEWARE_STACK = [];

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
type ActionMiddleware<TContext, TReturn> = (
  request: ActionRequest<TContext>
) => Promise<TReturn>;

/**
 * Read more: Docs: [`Action Handler`](https://next-action-router.netlify.app/concepts/action-handler)
 */
type ActionHandler<TContext, TErrorCodes extends PropertyKey, TReturn> = (
  request: ActionRequest<TContext>,
  response: ActionResponse<TErrorCodes>
) => Promise<TReturn>;

type ActionRouterConfig<TErrorCodes extends Record<string, string>> = {
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
  _schemaIdx: number = INTIAL_SCHEMA_IDX;
  /**
   * @private This is a private property. Do not touch this!
   */
  _schema: ZodSchema<any> | null = INTIAL_SCHEMA;
  /**
   * @private This is a private property. Do not touch this!
   */
  _middlewares: Array<any> = INITIAL_MIDDLEWARE_STACK;
  /**
   * @private This is a private property. Do not touch this!
   */
  private _config: ActionRouterConfig<TErrorCodes>;

  constructor(config?: ActionRouterConfig<TErrorCodes>) {
    this._config = config ?? ({ error: { codes: {} } } as any);
  }

  /**
   * Registers an action middleware.
   *
   * Read more: Docs: [`Input Validation`](https://next-action-router.netlify.app/concepts/middlewares)
   */
  use<TReturn extends { inputs: any } = { inputs: null }>(
    middleware: ActionMiddleware<TContext, TReturn>
  ): ActionRouter<TErrorCodes, TReturn> {
    this._middlewares.push(middleware);
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
    if (this._schema) {
      throw Error(
        "Only one input call is allowed in a single action router chain."
      );
    }
    this._schema = schema;
    this._schemaIdx = this._middlewares.length;
    return this as any;
  }

  /**
   * Executes the whole middleware stack and returns
   * the final context
   */
  private async executeMiddlewareStack(
    params: TContext["inputs"],
    cookies: NextCookies,
    headers: NextHeaders
  ): Promise<TContext> {
    // only if schema exists
    const hasSchema = !!this._schema;
    const shouldValidateIntially = this._schemaIdx === 0;

    // flag to keep track if inputs are already verified
    // during the execution of the middlewares
    let hasValidated = false;
    let initialInput = null;

    // validate inputs if schema is registered before all the middlewares
    if (hasSchema && shouldValidateIntially) {
      initialInput = await this._schema?.parseAsync(params);
      hasValidated = true;
    }

    // starting out with the initial context
    let context: any = { inputs: initialInput };
    for (let i = 0; i < this._middlewares.length; ++i) {
      if (hasSchema && !hasValidated && i === this._schemaIdx) {
        // @ts-expect-error
        context["inputs"] = await this._schema.parseAsync(params);
      }
      const middleware = this._middlewares[i];
      // each middleware gets the output of the last middleware
      // as input context through args
      context = await middleware({ context, cookies, headers });
    }

    // if input schema is registered and directly `run` is called
    // then also we need validated inputs
    if (
      hasSchema &&
      !hasValidated &&
      this._schemaIdx >= this._middlewares.length
    ) {
      context["inputs"] = await this._schema?.parseAsync(params);
    }
    return context;
  }

  /**
   * Register an action handler function.
   *
   * Read more: Docs: [`run`](https://next-action-router.netlify.app/concepts/action-handler)
   */
  run<TReturn>(handler: ActionHandler<TContext, keyof TErrorCodes, TReturn>) {
    return async (params: TContext["inputs"]) => {
      // create action response object
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

      try {
        // action request object creation
        const nextHeaders = headers();
        const nextCookies = cookies();
        const context = await this.executeMiddlewareStack(
          params,
          nextCookies,
          nextHeaders
        );
        const actionRequest: ActionRequest<TContext> = {
          context,
          cookies: nextCookies,
          headers: nextHeaders,
        };

        // 3. invoke handler with injected dependencies
        return handler(actionRequest, actionResponse);
      } catch (err) {
        // 4. handle errors gracefully

        // redirect error and not found error must be re-thrown
        if (isRedirectError(err) || isNotFoundError(err)) {
          throw err;
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
    branch._middlewares = [...this._middlewares];
    branch._schema = this._schema;
    branch._schemaIdx = this._schemaIdx;

    return branch as any;
  }
}
// #endregion Implementaion end
