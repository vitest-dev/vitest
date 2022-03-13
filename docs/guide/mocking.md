# Mocking
When writing tests it's only a matter of time before you need to create "fake" version of an internal—or external—service. This is commonly referred to as **mocking**. Vitest provides utility functions to help you out through its **vi** helper. You can `import { vi } from 'vitest'` or access it **globally** (when [global configuration](/config/#globals) is **enabled**).

::: warning
Always remember to clear or restore mocks before or after each test run to undo mock state changes between runs! See [`mockReset`](/api/#mockreset) docs for more info.
:::

If you wanna dive in head first, check out the [API section](/api/#vi) otherwise keep reading to take a deeper dive into the world of mocking.

## Dates

Sometimes you need to be in control of the date to ensure consistency when testing. Vitest uses [`@sinonjs/fake-timers`](https://github.com/sinonjs/fake-timers) package for manipulating timers, as well as system date. You can find more about the specific API in detail [here](/api/#vi-setsystemtime).

### Example

```js
import { afterEach, describe, expect, it, vi } from 'vitest'

const businessHours = [9, 17]

const purchase = () => {
  const currentHour = new Date().getHours()
  const [open, close] = businessHours

  if (currentHour > open && currentHour < close)
    return { message: 'Success' }

  return { message: 'Error' }
}

describe('purchasing flow', () => {
  beforeEach(() => {
    // tell vitest we use mocked time
    vi.useFakeTimers()
  })

  afterEach(() => {
    // restoring date after each test run
    vi.useRealTimers()
  })

  it('allows purchases within business hours', () => {
    // set hour within business hours
    const date = new Date(2000, 1, 1, 13)
    vi.setSystemTime(date)

    // access Date.now() will result in the date set above
    expect(purchase()).toEqual({ message: 'Success' })
  })

  it('disallows purchases outside of business hours', () => {
    // set hour outside business hours
    const date = new Date(2000, 1, 1, 19)
    vi.setSystemTime(date)

    // access Date.now() will result in the date set above
    expect(purchase()).toEqual({ message: 'Error' })
  })
})
```

## Functions

Mocking functions can be split up into two different categories; *spying & mocking*.

Sometimes all you need is to validate whether or not a specific function has been called (and possibly which arguments were passed). In these cases a spy would be all we need which you can use directly with `vi.spyOn()` ([read more here](/api/#vi-spyon)).

However spies can only help you **spy** on functions, they are not able to alter the implementation of those functions. In the case where we do need to create a fake (or mocked) version of a function we can  use `vi.fn()` ([read more here](/api/#vi-fn)).

We use [Tinyspy](https://github.com/Aslemammad/tinyspy) as a base for mocking functions, but we have our own wrapper to make it `jest` compatible. Both `vi.fn()` and `vi.spyOn()` share the same methods, however only the return result of `vi.fn()` is callable.

### Example

```js
import { afterEach, describe, expect, it, vi } from 'vitest'

const getLatest = (index = messages.items.length - 1) => messages.items[index]

const messages = {
  items: [
    { message: 'Simple test message', from: 'Testman' },
    // ...
  ],
  getLatest, // can also be a `getter or setter if supported`
}

describe('reading messages', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should get the latest message with a spy', () => {
    const spy = vi.spyOn(messages, 'getLatest')
    expect(spy.getMockName()).toEqual('getLatest')

    expect(messages.getLatest()).toEqual(
      messages.items[messages.items.length - 1],
    )

    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockImplementationOnce(() => 'access-restricted')
    expect(messages.getLatest()).toEqual('access-restricted')

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('should get with a mock', () => {
    const mock = vi.fn().mockImplementation(getLatest)

    expect(mock()).toEqual(messages.items[messages.items.length - 1])
    expect(mock).toHaveBeenCalledTimes(1)

    mock.mockImplementationOnce(() => 'access-restricted')
    expect(mock()).toEqual('access-restricted')

    expect(mock).toHaveBeenCalledTimes(2)

    expect(mock()).toEqual(messages.items[messages.items.length - 1])
    expect(mock).toHaveBeenCalledTimes(3)
  })
})
```

### More

- [Jest's Mock Functions](https://jestjs.io/docs/mock-function-api)

## Modules

Mock modules observe third-party-libraries, that are invoked in some other code, allowing you to test arguments, output or even redeclare its implementation.

See the [`vi.mock()` api section](/api/#vi-mock) for a more in depth detailed API description.

### Automocking algorithm

If your code is importing mocked module, without any associated `__mocks__` file or `factory` for this module, Vitest will mock the module itself by invoking it and mocking every export.

The following principles apply
* All arrays will be emptied
* All primitives and collections will stay the same
* All objects will be deeply cloned
* All instances of classes and their prototypes will be deeply cloned

### Example

```js
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { Client } from 'pg'

// handlers
export function success(data) {}
export function failure(data) {}
// get todos
export const getTodos = async(event, context) => {
  const client = new Client({
    // ...clientOptions
  })

  await client.connect()

  try {
    const result = await client.query('SELECT * FROM todos;')

    client.end()

    return success({
      message: `${result.rowCount} item(s) returned`,
      data: result.rows,
      status: true,
    })
  }
  catch (e) {
    console.error(e.stack)

    client.end()

    return failure({ message: e, status: false })
  }
}

vi.mock('pg', () => {
  return {
    Client: vi.fn(() => ({
      connect: vi.fn(),
      query: vi.fn(),
      end: vi.fn(),
    })),
  }
})

vi.mock('./handler.js', () => {
  return {
    success: vi.fn(),
    failure: vi.fn(),
  }
})

describe('get a list of todo items', () => {
  let client

  beforeEach(() => {
    client = new Client()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should return items successfully', async() => {
    client.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })

    await getTodos()

    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith('SELECT * FROM todos;')
    expect(client.end).toBeCalledTimes(1)

    expect(success).toBeCalledWith({
      message: '0 item(s) returned',
      data: [],
      status: true,
    })
  })

  it('should throw an error', async() => {
    const mError = new Error('Unable to retrieve rows')
    client.query.mockRejectedValueOnce(mError)

    await getTodos()

    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith('SELECT * FROM todos;')
    expect(client.end).toBeCalledTimes(1)
    expect(failure).toBeCalledWith({ message: mError, status: false })
  })
})
```

## Requests

Because Vitest runs in Node, mocking network requests is tricky; web APIs are not available, so we need something that will mimic network behavior for us. We recommend [Mock Service Worker](https://mswjs.io/) to accomplish this. It will let you mock both `REST` and `GraphQL` network requests, and is framework agnostic.

Mock Service Worker (MSW) works by intercepting the requests your tests make, allowing you to use it without changing any of your application code. In-browser, this uses the [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API). In Node.js, and for Vitest, it uses [node-request-interceptor](https://mswjs.io/docs/api/setup-server#operation). To learn more about MSW, read their [introduction](https://mswjs.io/docs/)


### Configuration

Add the following to your test [setup file](/config/#setupfiles)
```js
import { afterAll, afterEach, beforeAll } from 'vitest'
import { setupServer } from 'msw/node'
import { graphql, rest } from 'msw'

const posts = [
  {
    userId: 1,
    id: 1,
    title: 'first post title',
    body: 'first post body',
  },
  // ...
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

We have a full working example which uses MSW: [React Testing with MSW](https://github.com/vitest-dev/vitest/tree/main/examples/react-testing-lib-msw).

### More
There is much more to MSW. You can access cookies and query parameters, define mock error responses, and much more! To see all you can do with MSW, read [their documentation](https://mswjs.io/docs/recipes).

## Timers

Whenever we test code that involves `timeOut`s or intervals, instead of having our tests it wait out or time-out. We can speed up our tests by using "fake" timers by mocking calls to `setTimeout` and `setInterval`, too.

See the [`vi.mock()` api section](/api/#vi-usefaketimer) for a more in depth detailed API description.

### Example

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const executeAfterTwoHours = (func) => {
  setTimeout(func, 1000 * 60 * 60 * 2) // 2 hours
}

const executeEveryMinute = (func) => {
  setInterval(func, 1000 * 60) // 1 minute
}

const mock = vi.fn(() => console.log('executed'))

describe('delayed execution', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('should execute the function', () => {
    executeAfterTwoHours(mock)
    vi.runAllTimers()
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('should not execute the function', () => {
    executeAfterTwoHours(mock)
    // advancing by 2ms won't trigger the func
    vi.advanceTimersByTime(2)
    expect(mock).not.toHaveBeenCalled()
  })
  it('should execute every minute', () => {
    executeEveryMinute(mock)
    vi.advanceTimersToNextTimer()
    vi.advanceTimersToNextTimer()
    expect(mock).toHaveBeenCalledTimes(1)
    vi.advanceTimersToNextTimer()
    expect(mock).toHaveBeenCalledTimes(2)
  })
})
```
