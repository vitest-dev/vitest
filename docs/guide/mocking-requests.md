# Mocking Requests

We recommend [Mock Service Worker](https://mswjs.io/) to mock network requests. It handles various types of network requests (like `REST` or `GraphQL`) and is framework agnostic.

## Why

We write tests in order to be able to ship with confidence. The more underlying behavior we mock, the less confidence we get since the system is less closer to real usage.

Mock Service Worker (MSW) on the other hand, does not mock any underlying behavior. What it does instead, it uses [Service Worker API](https://developers.google.com/web/fundamentals/primers/service-workers) to intercept these requests.

To read more about why to choose Mock Service Worker: [Introduction to MSW](https://mswjs.io/docs/).

## Configuration

Create a `handlers.ts` file to specify the requests that need intercepting

```js
import { rest } from 'msw'
import { posts } from './src/mocks/posts'

export const handlers = [
  rest.get('url-to-be-captured', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(posts))
  }),
]
```

Create a `server.ts` file to add the handlers to a MSW server

```js
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// add handlers to the MSW server
export const server = setupServer(...handlers)
```

Add the following to your (test) setup file

```js
import { beforeAll, afterAll, afterEach } from 'vitest';
import { server } from './mocks/server'

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

//  Close server after all tests
afterAll(() => server.close())

// Reset handlers after each test `important for test isolation`
afterEach(() => server.resetHandlers())
```
You can find more information on the the `onUnhandledRequest` option [here](https://mswjs.io/docs/recipes/debugging-uncaught-requests)

## Example

We have a full working example which uses MSW: [React Testing with MSW](https://github.com/vitest-dev/vitest/tree/main/test/react-testing-lib-msw).

## More

There is much more to MSW. You can go access cookies, query parameters, define mock error responses and much more! We highly recommend to read [their documentation](https://mswjs.io/docs/recipes) to dive in further, as it is a very extensive and powerfull tool. MSW is as close as you are going to get to "mock" **real** networks requests in your test environment.
