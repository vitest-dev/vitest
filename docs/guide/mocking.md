# Mocking
When writing tests it's only a matter of time before you need to create 'fake' version of an internal- or external service. This is commonly referred to as **mocking**. Vitest provides utility functions to help you out in the form it's `vi` helper. You can `import { vi } from 'vitest'` or accessed globally (when global configuration is enabled).

Following are some example implementations of common test cases that require mocking. If you want to dive in head first visit the [vi API section](https://vitest.dev/guide/api.html#vi) otherwise keep reading to take it step by step.

## Dates

Vitest comes with [`mockdate`](https://www.npmjs.com/package/mockdate) package that lets you easily manipulate system date in your tests.

### Example

## Functions

Mock functions (or "spies") observe functions, that are invoked in some other code, allowing you to test its arguments, output or even redeclare its implementation.

We use [Tinyspy](https://github.com/Aslemammad/tinyspy) as a base for mocking functions, but we have our own wrapper to make it `jest` compatible.

Both `vi.fn()` and `vi.spyOn()` share the same methods, but the return result of `vi.fn()` is callable.

### Example


### More

- [Jest's Mock Functions](https://jestjs.io/docs/mock-function-api)

## Modules

Vitest provides utility functions to mock modules. You can access them on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

### Example

### Automocking algorithm

If your code is importing mocked module, but there are no `__mocks__` file for this module or a `factory`, Vitest will mock the module itself by invoking it and mocking every export.

* All arrays will be emptied
* All primitives and collections will stay the same
* All objects will be deeply cloned
* All instances of classes and their prototypes will be deeply cloned

### More

## Requests

Because Vitest runs in Node, mocking network requests is tricky; web APIs are not available, so we need something that will mimic network behavior for us. We recommend [Mock Service Worker](https://mswjs.io/) to accomplish this. It will let you mock both `REST` and `GraphQL` network requests, and is framework agnostic.

Mock Service Worker (MSW) works by intercepting the requests your tests make, allowing you to use it without changing any of your application code. In-browser, this uses the [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API). In Node.js, and for Vitest, it uses [node-request-interceptor](https://mswjs.io/docs/api/setup-server#operation). To learn more about MSW, read their [introduction](https://mswjs.io/docs/)


### Configuration

Add the following to your test [setup file](/config/#setupfiles)
```js
import { beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { graphql, rest } from 'msw'

const posts = [
  {
    userId: 1,
    id: 1,
    title: 'first post title',
    body: 'first post body',
  },
  ...
]

export const restHandlers = [
  rest.get('https://rest-endpoint.example/path/to/posts', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(posts))
  }),
]

const graphqlHandlers = [
  graphql.query('https://graphql-endpoint.example/api/v1/posts', (req, res, ctx) => {
    return res(ctx.data(posts))
  }),
]

const server = setupServer(...restHandlers, ...graphqlHandlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

//  Close server after all tests
afterAll(() => server.close())

// Reset handlers after each test `important for test isolation`
afterEach(() => server.resetHandlers())
```

> Configuring the server with `onUnhandleRequest: 'error'` ensures that an error is thrown whenever there is a request that does not have a corresponding request handler.

### Example

We have a full working example which uses MSW: [React Testing with MSW](https://github.com/vitest-dev/vitest/tree/main/test/react-testing-lib-msw).

### More
There is much more to MSW. You can access cookies and query parameters, define mock error responses, and much more! To see all you can do with MSW, read [their documentation](https://mswjs.io/docs/recipes).

## Timers

To make your tests faster, you can mock calls to `setTimeout` and `setInterval`. All methods to manipulate timers are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

### Configuration
All useful methods are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

### Example


### More
