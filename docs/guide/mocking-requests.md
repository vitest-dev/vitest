# Mocking Requests

We write tests in order to be able to ship with confidence. The more underlying behavior we mock, the less confidence we get since the system is less closer to real usage.

Mocking network requests is one of those tricky aspects of running tests in a non-browser environment. Web API's are not available so now we need to mock or install something that mocks this behavior.

There are various tools for this job, but which one do you choose?

We recommend [Mock Service Worker](https://mswjs.io/) to mock network requests. It handles both `REST` and `GraphQL` type of network requests and is framework agnostic.

Mock Service Worker (or MSW in short) uses [Service Worker API](https://developers.google.com/web/fundamentals/primers/service-workers) to intercept requests. It has a variety of use cases but also offers functionality specifically for `node`. It won't magically make `service workers API` available for non-browser environments, but instead relies on [node-request-interceptor](https://mswjs.io/docs/api/setup-server#operation).

To read more about MSW, read their [introduction](https://mswjs.io/docs/).

## Configuration

Add the following to your (test) setup file
```js
import { beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node'
import { graphql, rest } from 'msw'

import { posts } from './src/mocks/posts'

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

## Example

We have a full working example which uses MSW: [React Testing with MSW](https://github.com/vitest-dev/vitest/tree/main/test/react-testing-lib-msw).

## More

There is much more to MSW. You can access cookies and query parameters, define mock error responses, and much more! To see all you can do with MSW, read [their documentation](https://mswjs.io/docs/recipes).
