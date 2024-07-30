# ✨ Next Server Action

A lightweight robust library for creating action routing, middleware, and input validation in Next.js (v14+) app router projects.

The goal of this library is to support maximum code reusability among different actions through out the project. Most of the api
style is similar to the express if you're already familiar with
express, then you can pick this up easily.

## How action routing works?

The basic idea behind action routing is simple. The action router lets you define a request-response lifecycle for any action request. You can choose a single rooter as a base for the action request-response lifecycles or even have mutiple
routing defined in a single project.

![Action routing visual flow diagram](https://github.com/bhishekprajapati/next-server-action/blob/main/public/action-routing.png?raw=true)

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Usage](#usage)

## Installation

To use My Library in your Next.js project, follow these steps:

```sh
npm install next-server-action zod
```

OR

```sh
pnpm install next-server-action zod
```

## Features

- ✅ **Action Routing**: Simplify the process of defining and handling server-side actions by express like routing mechanism.
- ✅ **Middleware Support**: Easily register and execute middleware functions with context passing.
- ✅ **Input Validation**: Leverage Zod schemas for robust input validation, ensuring data integrity.
- ✅ **Error Handling**: Robust error handling mechanisms with type safe error codes.
- ✅ **Type Safety**: Extensive use of TypeScript for type-safe operations and improved developer experience.

## Usage

In your nextjs v14 app router project. I'll just give you an example in the way I prefer to organize the code.
This example is for `app router` (without using src directory). However, you can use the src directory or even organize in any way you want.

### Basic Usage

```ts
// lib/action.router.ts
/**
 * import {ActionRouter} from the server directory.
 */
import { ActionRouter } from "next-server-action/server";

/**
 * This router will server as an entry point for the
 * incoming action requests. However, you can create as many
 * routers as you need for your project.
 */
export const router = new ActionRouter();
```

```ts
// app/actions/blogs.ts
"use server";
import { router } from "@/lib/action.router.ts";

// fake blogs
const blogs = [
  {
    id: 1,
    title: "Blog 1",
  },
  {
    id: 2,
    title: "Blog 2",
  },
];

export const findAllBlogs = router.run(async (request, response) =>
  response.data(blogs)
);
```

```tsx
"use client";
import { findAllBlogs } from "@/app/actions/blogs.ts";

const Button = () => (
  <button
    onCLick={async () => {
      const response = await findAllBlogs();
      if (response.success) {
        console.log(response.data);
      } else {
        console.error(response.error);
      }
    }}
  >
    Blogs
  </button>
);
```

### Register global middlewares

**NOTE**: Each middleware registered at any level must need to return
the updated context. The updated context will be provided as input
to the next middleware from the stack.

Apart from the context, you can accesas cookies and headers from the request.

**USE CASE**: Middleware is the best place to extend or mutate the context
object as the request progresses through chain.

```ts
// lib/action.router.ts
import { ActionRouter } from "next-server-action/server";

export const router = new ActionRouter();
router
  .use(async ({ context, cookies, headers }) => {
    console.log("Global middleware 1");
    console.log("Will run 1st");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Global middleware 2");
    console.log("Will run 2nd");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Global middleware 3");
    console.log("Will run 3rd");
    return context;
  });
```

### Register sub-action router level middlewares

```ts
// app/actions/blogs.ts
import { router } from "@/lib/action.router.ts";

const blogsRouter = router
  .use(async ({ context }) => {
    console.log("Blog middleware 1");
    console.log("Will run 1st");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Blog middleware 2");
    console.log("Will run 2nd");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Blog middleware 3");
    console.log("Will run 3rd");
    return context;
  });
```

OR

```ts
// app/actions/products.ts
import { router } from "@/lib/action.router.ts";

const productRouter = router
  .use(async ({ context }) => {
    console.log("Product middleware 1");
    console.log("Will run 1st");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Product middleware 2");
    console.log("Will run 2nd");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Product middleware 3");
    console.log("Will run 3rd");
    return context;
  });
```

### Register method level middlewares

```ts
// app/actions/blogs.ts
import { router } from "@/lib/action.router.ts";

const blogsRouter = router
  .use(async ({ context }) => {
    console.log("Blog middleware 1");
    console.log("Will run 1st");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Blog middleware 2");
    console.log("Will run 2nd");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Blog middleware 3");
    console.log("Will run 3rd");
    return context;
  });

const findAllBlogs = blogsRouter
  .use(async ({ context }) => {
    console.log("Find all blog method middleware 1");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Find all blog method middleware 2");
    return context;
  })
  .run(async () => {
    // action handler
  });
```

OR

```ts
// app/actions/products.ts
import { router } from "@/lib/action.router.ts";

const productRouter = router
  .use(async ({ context }) => {
    console.log("Product middleware 1");
    console.log("Will run 1st");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Product middleware 2");
    console.log("Will run 2nd");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Product middleware 3");
    console.log("Will run 3rd");
    return context;
  });

const findAllProducts = productRouter
  .use(async ({ context }) => {
    console.log("Find all products method middleware 1");
    return context;
  })
  .use(async ({ context }) => {
    console.log("Find all products method middleware 2");
    return context;
  })
  .run(async () => {
    // action handler
  });
```
