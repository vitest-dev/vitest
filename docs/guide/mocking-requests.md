# Mocking Requests

We recommend [Mock Service Worker](https://mswjs.io/) to mock network requests. It handles various types of network requests (like `REST` or `GraphQL`) and is framework agnostic.

## Why

We write tests in order to be able to ship with confidence. The more underlying behavior we mock, the less confidence we get since the system is less closer to real usage.

Mock Service Worker (MSW) on the other hand, does not mock any underlying behavior. What it does instead, it uses [Service Worker API](https://developers.google.com/web/fundamentals/primers/service-workers) to intercept these requests.

To read more about why to choose Mock Service Worker: [Introduction to MSW](https://mswjs.io/docs/).

## Configuration

Create a file that includes the requests that need to be intercepted and sets up the server.
```js
import { graphql, rest } from 'msw'
import { setupServer } from 'msw/node'

import { posts } from './src/mocks/posts'

export const restHandlers = [
  rest.get('https://url.to/be/captured', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(posts))
  }),
]

export const graphqlHandlers = [
  graphql.query('posts', (req, res, ctx) => {
    return res(ctx.data(posts))
  }),
]

export const server = setupServer(...restHandlers, ...graphqlHandlers)
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

> Configuring the server with `onUnhandleRequest: 'error'` ensures that an error is thrown whenever there is a request that does not have a corresponding request handler.

## Example

We have a full working example which uses MSW: [React Testing with MSW](https://github.com/vitest-dev/vitest/tree/main/test/react-testing-lib-msw).

## More

There is much more to MSW. You can access cookies and query parameters, define mock error responses, and much more! To see all you can do with MSW, read [their documentation](https://mswjs.io/docs/recipes).
