
# Mocking Requests

When it comes to mocking network requests, we recommend you using [Mock Service Worker](https://mswjs.io/).

You can mock both REST and GraphQL APIs using Mock Service Worker. It is also Framework agnostic!

## Why

We write tests in order to be able to ship with confidence. The more underlying behavior we mock, the less confidence we get since the system is less closer to real usage.

Mock Service Worker (MSW) on the other hand, does not mock any underlying behavior. When you make requests in your tests, you are making **real** requests. What it does instead, it uses [Service Worker API](https://developers.google.com/web/fundamentals/primers/service-workers) to intercept these requests.

To read more about why to choose Mock Service Worker: [Introduction to MSW](https://mswjs.io/docs/).

## How

As mentioned above, MSW takes uses Service Worker API to intercept the requests. There are a few things we need to do in order for our requests to be intercepted.

1. We first need to define the specific requests we want to intercept, where we also return the mock data.

```js
// ./src/mocks/handlers.ts
import { rest } from 'msw'

// Mock Data
export const posts = [
  {
    userId: 1,
    id: 1,
    title: 'title',
    body: 'body',
  },
]

// Define handlers that catch the corresponding requests and returns the mock data.
export const handlers = [
  rest.get('https://jsonplaceholder.typicode.com/posts', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(posts))
  }),
]
```

2. We need to configure a Service Worker with the handlers we defined.

```js
// ./src/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// This configures a Service Worker with the given request handlers.
export const server = setupServer(...handlers)
```

3. The last step is just to start the server! 

Starting and closing the server is done in a setup file which runs everytime before the tests.

```js
// ./src/setup.ts
import { server } from './mocks/server'

// Start server before all tests
// onUnhandledRequest is set to "error", meaning an error will be thrown if we make requests that we haven't defined in the handlers (important since we don't want to make real requests).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

//  Close server after all tests
afterAll(() => server.close())

// Reset handlers after each test which is important for test isolation.
afterEach(() => server.resetHandlers())
```

## Example

We have a full working example which uses MSW: [React Testing with MSW](../../test/react-testing-lib-msw/).

## More

There is much more to MSW.

We highly suggest you to read their documentation, it is both powerful and configurable: [Mock Service Worker](https://mswjs.io/).

PS. You can even access cookies, query parameters, define mock error responses and much more! Don't forget, with MSW we are making **real** requests in the browser after all.