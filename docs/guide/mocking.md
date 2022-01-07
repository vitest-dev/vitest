# Mocking
When writing tests it's only a matter of time before you need to create 'fake' version of an internal- or external service. This is commonly referred to as **mocking**. Vitest provides utility functions to help you out through it's **vi** helper. You can `import { vi } from 'vitest'` or access it **globally** (when [global configuration](../config/#global) is **enabled**).

> Always remember to clear or restore mocks before or after each test run to save head scratching along the line!

If you wanna dive in head first, check out the [API section](../api/#creating-mocks) otherwise keep reading to take a deeper dive into the world of mocking.

## Dates

Sometimes you need to be in control of the date's to allow for consistency when testing. Vitest comes with [`mockdate`](https://www.npmjs.com/package/mockdate) package baked-in to let you easily manipulate the system date in your tests. You can find more about the specific API in detail [here](../api/#vi-mockcurrentdate).

### Example

```js
import { afterEach, describe, expect, it, vi } from 'vitest'

const businessHours = [9, 17];

const purchase = () => {
  const currentHour = new Date().getHours()
  const [open, close] = businessHours

  if (currentHour > open && currentHour < close) {
    return { message: 'Success' }
  }

  return { message: 'Error' }
};

describe('purchasing flow', () => {
  afterEach(() => {
    // restoring date after each test run
    vi.restoreCurrentDate()
  });

  it('allows purchases within business hours', () => {
    // set hour within business hours
    const date = new Date(2000, 1, 1, 13)
    vi.mockCurrentDate(date)

    // access Date.now() will result in the date set above
    expect(purchase()).toEqual({ message: 'Success' })
  })

  it('disallows purchases outside of business hours', () => {
    // set hour outside business hours
    const date = new Date(2000, 1, 1, 19)
    vi.mockCurrentDate(date)

    // access Date.now() will result in the date set above
    expect(purchase()).toEqual({ message: 'Error' })
  })
})
```

## Functions
Mock functions (or "spies") observe functions, that are invoked in some other code, allowing you to test its arguments, output or even redeclare its implementation.

We use [Tinyspy](https://github.com/Aslemammad/tinyspy) as a base for mocking functions, but we have our own wrapper to make it `jest` compatible. Both `vi.fn()` and `vi.spyOn()` share the same methods, however only the return result of `vi.fn()` is callable.

Check out the [`vi.fn()`](../api/#vi-fn) or [`vi.spyOn()`](../api/#vi-spyon) api sections for more specifics.

### Example

```js
import { afterEach, describe, expect, it, vi } from 'vitest';

const getLatest = (index = messages.items.length - 1) => messages.items[index];

const messages = {
  items: [
    { message: 'Simple test message', from: 'Testman' },
    // ...
  ],
  getLatest, // can also be a `getter or setter if supported`
};

describe('reading messages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should get the latest message with a spy', () => {
    const spy = vi.spyOn(messages, 'getLatest');
    expect(spy.getMockName(), 'getLatest');

    expect(messages.getLatest()).toEqual(
      messages.items[messages.items.length - 1]
    );

    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockImplementationOnce(() => 'access-restricted');
    expect(messages.getLatest()).toEqual('access-restricted');

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should get with a mock', () => {
    const mock = vi.fn().mockImplementation(getLatest);

    expect(mock()).toEqual(messages.items[messages.items.length - 1]);
    expect(mock).toHaveBeenCalledTimes(1);

    mock.mockImplementationOnce(() => 'access-restricted');
    expect(mock()).toEqual('access-restricted');

    expect(mock).toHaveBeenCalledTimes(2);

    expect(mock()).toEqual(messages.items[messages.items.length - 1]);
    expect(mock).toHaveBeenCalledTimes(3);
  });
});
```

### More

- [Jest's Mock Functions](https://jestjs.io/docs/mock-function-api)

## Modules

Vitest provides utility functions to mock modules. You can access them on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

### Automocking algorithm

If your code is importing mocked module, but there are no `__mocks__` file for this module or a `factory`, Vitest will mock the module itself by invoking it and mocking every export.

* All arrays will be emptied
* All primitives and collections will stay the same
* All objects will be deeply cloned
* All instances of classes and their prototypes will be deeply cloned

### Example

```js
import { afterEach, describe, expect, test, vi } from 'vitest'

describe('testing date mock functionality', () => {
  afterEach(() => {
    vi.restoreCurrentDate()
  })

  test('seting time in the past', () => {
    const date = new Date(2000, 1, 1)

    vi.mockCurrentDate(date)

    expect(Date.now()).toBe(date.valueOf())
    expect(vi.getMockedDate()).toBe(date)

    vi.restoreCurrentDate()

    expect(Date.now()).not.toBe(date.valueOf())
    expect(vi.getMockedDate()).not.toBe(date)
  })

  test('setting time in different types', () => {
    const time = 1234567890

    vi.mockCurrentDate(time)

    expect(Date.now()).toBe(time)

    const timeStr = 'Fri Feb 20 2015 19:29:31 GMT+0530'
    const timeStrMs = 1424440771000

    vi.mockCurrentDate(timeStr)

    expect(Date.now()).toBe(timeStrMs)
  })
})
```

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

### Example

```js
import { expect, test, vi } from 'vitest'
import { timeout } from '../src/timeout'

test('timeout', async() => {
  const t = vi.fn()

  vi.useFakeTimers()

  setTimeout(t, 50)
  const timeout = setTimeout(t, 50)
  clearTimeout(timeout)

  vi.runOnlyPendingTimers()
  vi.useRealTimers()

  expect(t).toBeCalledTimes(1)
})

test('advance timeout', () => {
  const t = vi.fn()

  vi.useFakeTimers()

  setTimeout(t, 50)

  vi.advanceTimersByTime(25)

  expect(t).not.toBeCalled()

  vi.advanceTimersByTime(25)

  expect(t).toBeCalledTimes(1)

  vi.useRealTimers()
})

test('interval', () => {
  let count = 0
  const i = vi.fn(() => {
    if (count === 20) clearInterval(interval)
    count++
  })

  vi.useFakeTimers()

  let interval = setInterval(i, 30)

  vi.runAllTimers()

  expect(i).toBeCalledTimes(21)
})

test('advance interval', () => {
  let count = 0
  const p = vi.fn()
  const i = vi.fn(() => {
    setInterval(p, 50)
    if (count === 3) clearInterval(interval)
    count++
  })

  vi.useFakeTimers()

  let interval = setInterval(i, 30)

  vi.advanceTimersByTime(100)

  expect(i).toBeCalledTimes(3)
  expect(p).toBeCalledTimes(1)

  vi.advanceTimersByTime(100)

  expect(i).toBeCalledTimes(4)
  expect(p).toBeCalledTimes(8)

  vi.useRealTimers()
})

test('async timer', async() => {
  const res: string[] = []

  vi.useFakeTimers()

  setTimeout(async() => {
    await Promise.resolve()
    res.push('item1')
  }, 100)

  setTimeout(async() => {
    await Promise.resolve()
    res.push('item2')
  }, 100)

  await vi.runAllTimers()
  vi.useRealTimers()

  expect(res).toEqual(['item1', 'item2'])
})

test('advance timer', async() => {
  const a1 = vi.fn()
  const a2 = vi.fn()

  vi.useFakeTimers()

  setTimeout(a1)
  setInterval(a2)

  vi.advanceTimersToNextTimer()

  expect(a1).toHaveBeenCalled()
  expect(a2).not.toHaveBeenCalled()

  vi.advanceTimersToNextTimer()

  expect(a2).toHaveBeenCalled()

  vi.advanceTimersToNextTimer()

  expect(a2).toHaveBeenCalledTimes(2)

  vi.useRealTimers()
})
```
