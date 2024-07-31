import "server-only";
import { z, ZodTypeAny, type ZodSchema } from "zod";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { isNotFoundError } from "next/dist/client/components/not-found";

// #region Types
// type utils
type ReplaceKeyValue<T extends {}, K extends keyof T, V> = Omit<T, K> &
  Record<K, V>;

/**
 * Represents an action request object with a context.
 * It contains the information regarding an action request.
 * Each action request will have it's own action request object.
 */
type ActionRequest<TContext> = {
  context: TContext;
  headers: ReturnType<typeof headers>;
  cookies: ReturnType<typeof cookies>;
};

type ActionSuccessResponse<TData> = {
  success: true;
  data: TData;
};

type ActionErrorResponse<TCode> = {
  success: false;
  error: {
    code: TCode;
    message: string;
  };
};
/**
 * Each action requests will have it's own action
 * response object. Registered action handlers can invoke these
 * provided methods from this object to send data, error
 * or even throwing redirects or not found errors to the client;
 */
type ActionResponse<TErrorCodes> = {
  data: <TData>(data: TData) => ActionSuccessResponse<TData>;
  error: <TCode extends TErrorCodes>(
    code: TCode,
    message?: string
  ) => ActionErrorResponse<TCode>;
  createError: <T extends string>(
    code: T,
    message: string
  ) => ActionErrorResponse<T>;
  redirect: typeof redirect;
  notFound: typeof notFound;
};

/**
 * Action router middleware function. Every middleware needs to
 * return the mutated or updated context. which can be consumed
 * as input by the next middleware from stack.
 */
type ActionMiddleware<TContext, TReturn> = (
  request: ActionRequest<TContext>
) => Promise<TReturn>;

/**
 * The action handler is responsible for the execution
 * of main logic. when the client invokes the server action.
 */
type ActionHandler<TContext, TErrorCodes, TReturn> = (
  request: ActionRequest<TContext>,
  response: ActionResponse<TErrorCodes>
) => Promise<TReturn>;

type ActionRouterConfig<TErrorCodes> = {
  error: {
    codes: TErrorCodes;
  };
};

type InputReturnType<
  TContext extends { inputs: any },
  TErrorCodes,
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
  TErrorCodes,
  TContext extends { inputs: any } = { inputs: void },
> {
  /**
   * @private This is a private property. Do not touch this!
   */
  _schemaIdx: number = -1;
  /**
   * @private This is a private property. Do not touch this!
   */
  _schema: ZodSchema<any> | null = null;
  /**
   * @private This is a private property. Do not touch this!
   */
  _middlewares: Array<any> = [];

  constructor(private _config: ActionRouterConfig<TErrorCodes>) {}

  /**
   * Register a action middleware.
   * Middlewares will run in the order of registration.
   * @returns Always return a context from your middlewares.
   * You can return the same context or even the updated one.
   */
  use<TReturn extends { inputs: any } = { inputs: null }>(
    middleware: ActionMiddleware<TContext, TReturn>
  ): ActionRouter<TErrorCodes, TReturn> {
    this._middlewares.push(middleware);
    return this as any;
  }

  /**
   * Register a zod schema which will be used
   * to validate the inputs provided to the
   * server action on the client side.
   *
   * NOTE: Once you call this then you can't create new branches. you
   * must end the branch here and register your action handler.
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
    params: TContext["inputs"]
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
      // @ts-expect-error
      initialInput = await this._schema.parseAsync(params);
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
      context = await middleware({ context });
    }

    return context;
  }

  /**
   * Register an action handler function. Which gets executed
   * when the client invokes the server action from the client side.
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
        const requestHeaders = headers();
        const requestCookies = cookies();
        const context = await this.executeMiddlewareStack(params);
        const actionRequest: ActionRequest<TContext> = {
          context,
          cookies: requestCookies,
          headers: requestHeaders,
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
   */
  branch(): this {
    /**
     * To successfully create a new branch.
     * step-1: create a new router instance
     * step-2: copy the internal state
     *         1. config
     *         2. middleware stack
     *         3. input schema
     *         4. input schema registration index
     */
    const branch = new ActionRouter(this._config);
    branch._config = this._config;
    branch._middlewares = [...this._middlewares];
    branch._schema = this._schema;
    branch._schemaIdx = this._schemaIdx;
    return branch as any;
  }
}
// #endregion Implementaion end
