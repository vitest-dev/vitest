# Mocking

When writing tests it's only a matter of time before you need to create fake version of an internal- or external service. This is commonly referred to as **mocking**. With vitest we have some built-in utilities to help you out in the most common scenarios. For basic usage you can read [the mocking part in features section](https://vitest.dev/guide/features.html#mocking) (if you haven't already) but for more detailed explanation keep reading!


<!-- DATE -->

## Dates

Vitest comes with [`mockdate`](https://www.npmjs.com/package/mockdate) package that lets you easily manipulate system date in your tests.

All useful methods are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

### mockCurrentDate

- **Type**: `(date: string | number | Date) => void`

Sets current date to the one that was passed. All `Date` calls will return this date.

Useful if you need to test anything that depends on the current date - for example [luxon](https://github.com/moment/luxon/) calls inside your code.

```ts
const date = new Date(1998, 11, 19)

vi.mockCurrentDate(date)

expect(Date.now()).toBe(date.valueOf())
```

### getMockedDate

- **Type**: `() => string | number | Date`

Returns mocked current date that was set using `mockCurrentDate`. If date is not mocked, will return `null`.

### restoreCurrentDate

- **Type**: `() => void`

Restores `Date` back to its native implementation.


-----------------------------------------------------------------------------------

<!-- FUNCTIONS -->

## Functions

Mock functions (or "spies") observe functions, that are invoked in some other code, allowing you to test its arguments, output or even redeclare its implementation.

We use [Tinyspy](https://github.com/Aslemammad/tinyspy) as a base for mocking functions, but we have our own wrapper to make it `jest` compatible.

Both `vi.fn()` and `vi.spyOn()` share the same methods, but the return result of `vi.fn()` is callable.

### vi.fn

**Type:** `(fn: Function) => CallableMockInstance`

Creates a spy on a function, though can be initiated without one. Every time a function is invoked, it stores its call arguments, returns and instances. Also, you can manipulate its behavior with [methods](#mockmethods).
If no function is given, mock will return `undefined`, when invoked.

```ts
const getApples = vi.fn(() => 0)

getApples()

expect(getApples).toHaveBeenCalled()
expect(getApples).toHaveReturnedWith(0)

getApples.mockReturnOnce(5)

const res = getApples()
expect(res).toBe(5)
expect(getApples).toHaveReturnedNthTimeWith(1, 5)
```

### vi.spyOn

**Type:** `<T, K extends keyof T>(object: T, method: K, accessType?: 'get' | 'set') => MockInstance`

Creates a spy on a method or getter/setter of an object.

```ts
let apples = 0
const obj = {
  getApples: () => 13,
}

const spy = vi.spyOn(obj, 'getApples').mockImplementation(() => apples)
apples = 1

expect(obj.getApples()).toBe(1)

expect(spy).toHaveBeenCalled()
expect(spy).toHaveReturnedWith(1)
```

## Mock methods

### mockName

**Type:** `(name: string) => MockInstance`

Sets internal mock name. Useful to see what mock has failed the assertion.

### getMockName

**Type:** `() => string`

Use it to return the name given to mock with method `.mockName(name)`.

### mockClear

**Type:** `() => MockInstance`

Clears all information about every call. After calling it, [`spy.mock.calls`](#mockcalls), [`spy.mock.returns`](#mockreturns) will return empty arrays. It is useful if you need to clean up spy between different assertions.

If you want this method to be called before each test automatically, you can enable [`clearMocks`](/config/#clearMocks) setting in config.

### mockReset

**Type:** `() => MockInstance`

Does what `mockClear` does and makes inner implementation as an empty function (returning `undefined`, when invoked). This is useful when you want to completely reset a mock back to its initial state.

If you want this method to be called before each test automatically, you can enable [`mockReset`](/config/#mockReset) setting in config.

### mockRestore

**Type:** `() => MockInstance`

Does what `mockRestore` does and restores inner implementation to the original function.

Note that restoring mock from `vi.fn()` will set implementation to an empty function that returns `undefined`. Restoring a `vi.fn(impl)` will restore implementation to `impl`.

If you want this method to be called before each test automatically, you can enable [`restoreMocks`](/config/#restoreMocks) setting in config.

### mockImplementation

**Type:** `(fn: Function) => MockInstance`

Accepts a function that will be used as an implementation of the mock.

For example:

```ts
const mockFn = vi.fn().mockImplementation(apples => apples + 1);
// or: vi.fn(apples => apples + 1);

const NelliesBucket = mockFn(0);
const BobsBucket = mockFn(1);

NelliesBucket === 1; // true
BobsBucket === 2; // true

mockFn.mock.calls[0][0] === 0; // true
mockFn.mock.calls[1][0] === 1; // true
```

### mockImplementationOnce

**Type:** `(fn: Function) => MockInstance`

Accepts a function that will be used as an implementation of the mock for one call to the mocked function. Can be chained so that multiple function calls produce different results.

```ts
const myMockFn = vi
  .fn()
  .mockImplementationOnce(() => true)
  .mockImplementationOnce(() => false);

myMockFn(); // true
myMockFn(); // false
```

When the mocked function runs out of implementations, it will invoke the default implementation that was set with `vi.fn(() => defaultValue)` or `.mockImplementation(() => defaultValue)` if they were called:

```ts
const myMockFn = vi
  .fn(() => 'default')
  .mockImplementationOnce(() => 'first call')
  .mockImplementationOnce(() => 'second call');

// 'first call', 'second call', 'default', 'default'
console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn());
```

### mockReturnThis

**Type:** `() => MockInstance`

Sets inner implementation to return `this` context.

### mockReturnValue

**Type:** `(value: any) => MockInstance`

Accepts a value that will be returned whenever the mock function is called.

```ts
const mock = vi.fn();
mock.mockReturnValue(42);
mock(); // 42
mock.mockReturnValue(43);
mock(); // 43
```

### mockReturnValueOnce

**Type:** `(value: any) => MockInstance`

Accepts a value that will be returned whenever mock function is invoked. If chained, every consecutive call will return passed value. When there are no more `mockReturnValueOnce` values to use, calls a function specified by `mockImplementation` or other `mockReturn*` methods.

```ts
const myMockFn = vi
  .fn()
  .mockReturnValue('default')
  .mockReturnValueOnce('first call')
  .mockReturnValueOnce('second call');

// 'first call', 'second call', 'default', 'default'
console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn());
```

### mockResolvedValue

**Type:** `(value: any) => MockInstance`

Accepts a value that will be resolved, when async function will be called.

```ts
test('async test', async () => {
  const asyncMock = vi.fn().mockResolvedValue(43);

  await asyncMock(); // 43
});
```

### mockResolvedValueOnce

**Type:** `(value: any) => MockInstance`

Accepts a value that will be resolved for one call to the mock function. If chained, every consecutive call will resolve passed value.

```ts
test('async test', async () => {
  const asyncMock = vi
    .fn()
    .mockResolvedValue('default')
    .mockResolvedValueOnce('first call')
    .mockResolvedValueOnce('second call');

  await asyncMock(); // first call
  await asyncMock(); // second call
  await asyncMock(); // default
  await asyncMock(); // default
});
```

### mockRejectedValue

**Type:** `(value: any) => MockInstance`

Accepts an error that will be rejected, when async function will be called.

```ts
test('async test', async () => {
  const asyncMock = vi.fn().mockRejectedValue(new Error('Async error'));

  await asyncMock(); // throws "Async error"
});
```

### mockRejectedValueOnce

**Type:** `(value: any) => MockInstance`

Accepts a value that will be rejected for one call to the mock function. If chained, every consecutive call will reject passed value.

```ts
test('async test', async () => {
  const asyncMock = vi
    .fn()
    .mockResolvedValueOnce('first call')
    .mockRejectedValueOnce(new Error('Async error'));

  await asyncMock(); // first call
  await asyncMock(); // throws "Async error"
});
```

## Mock properties

### mock.calls

This is an array containing all arguments for each call. One item of the array is arguments of that call.

If a function was invoked twice with the following arguments `fn(arg1, arg2)`, `fn(arg3, arg4)` in that order, then `mock.calls` will be:

```js
[
  ['arg1', 'arg2'],
  ['arg3', 'arg4'],
];
```

### mock.results

This is an array containing all values, that were `returned` from function. One item of the array is an object with properties `type` and `value`. Available types are:

- `'return'` - function returned without throwing.
- `'throw'` - function threw a value.

The `value` property contains returned value or thrown error.

If function returned `'result1`, then threw and error, then `mock.results` will be:

```js
[
  {
    type: 'return',
    value: 'result',
  },
  {
    type: 'throw',
    value: Error,
  },
];
```

### mock.instances

Currently, this property is not implemented.

### See also

- [Jest's Mock Functions](https://jestjs.io/docs/mock-function-api)


-----------------------------------------------------------------------------------

<!-- MODULES -->

## Modules

Vitest provides utility functions to mock modules. You can access them on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

### mock

**Type**: `(path: string, factory?: () => any) => void`

Makes all `imports` to passed module to be mocked. Inside a path you _can_ use configured Vite aliases.

- If there is a `factory`, will return its result. The call to `vi.mock` is hoisted to the top of the file,
so you don't have access to variables declared in the global file scope, if you didn't put them before imports!
- If `__mocks__` folder with file of the same name exist, all imports will return its exports.
- If there is no `__mocks__` folder or a file with the same name inside, will call original module and mock it.

### unmock

**Type**: `(path: string) => void`

Removes module from mocked registry. All subsequent calls to import will return original module even if it was mocked.

### importActual

**Type**: `<T>(path: string) => Promise<T>`

Imports module, bypassing all checks if it should be mocked. Can be useful if you want to mock module partially.

```ts
vi.mock('./example', async () => {
  const axios = await vi.importActual('./example')

  return { ...axios, get: vi.fn() }
})
 ```

### importMock

**Type**: `<T>(path: string) => Promise<MaybeMockedDeep<T>>`

Imports a module with all of its properties (including nested properties) mocked. Follows the same rules that [`vi.mock`](#mock) follows. For the rules applied, see [algorithm](#automockingalgorithm).

### mocked

**Type**: `<T>(obj: T, deep?: boolean) => MaybeMockedDeep<T>`

Type helper for TypeScript. In reality just returns the object that was passed.

```ts
import example from './example'
vi.mock('./example')

test('1+1 equals 2' async () => {
 vi.mocked(example.calc).mockRestore()

 const res = example.calc(1, '+', 1)

 expect(res).toBe(2)
})
```

### Automocking algorithm

If your code is importing mocked module, but there are no `__mocks__` file for this module or a `factory`, Vitest will mock the module itself by invoking it and mocking every export.

* All arrays will be emptied
* All primitives and collections will stay the same
* All objects will be deeply cloned
* All instances of classes and their prototypes will be deeply cloned

-----------------------------------------------------------------------------------

<!-- REQUESTS -->

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

-----------------------------------------------------------------------------------

<!-- TIMERS -->

## Timers

To make your tests faster, you can mock calls to `setTimeout` and `setInterval`. All methods to manipulate timers are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

###  useFakeTimers

**Type:** `() => Vitest`

To enable mocking timers, you need to call this method. It will wrap all further calls to timers, until [`vi.useRealTimers()`](#userealtimers) is called.

### useRealTimers

**Type:** `() => Vitest`

When timers are run out, you may call this method to return mocked timers to its original implementations. All timers that were run before will not be restored.

### runOnlyPendingTimers

**Type:** `() => Vitest`

This method will call every timer that was initiated after `vi.useFakeTimers()` call. It will not fire any timer that was initiated during its call. For example this will only log `1`:

```ts
let i = 0
setInterval(() => console.log(++i), 50)

vi.runOnlyPendingTimers()
```

### runAllTimers

**Type:** `() => Vitest`

This method will invoke every initiated timer until the timers queue is empty. It means that every timer called during `runAllTimers` will be fired. If you have an infinite interval,
it will throw after 10 000 tries. For example this will log `1, 2, 3`:

```ts
let i = 0
setTimeout(() => console.log(++i))
let interval = setInterval(() => {
    console.log(++i)
    if (i === 2) {
        clearInterval(interval)
    }
}, 50)

vi.runAllTimers()
```

### advanceTimersByTime

**Type:** `(ms: number) => Vitest`

Works just like `runAllTimers`, but will end after passed milliseconds. For example this will log `1, 2, 3` and will not throw:

```ts
let i = 0
setInterval(() => console.log(++i), 50)

vi.advanceTimersByTime(150)
```

### advanceTimersToNextTimer

**Type:** `() => Vitest`

Will call next available timer. Useful to make assertions between each timer call. You can chain call it to manage timers by yourself.

```ts
let i = 0
setInterval(() => console.log(++i), 50)

vi.advanceTimersToNextTimer() // log 1
  .advanceTimersToNextTimer() // log 2
  .advanceTimersToNextTimer() // log 3
```
