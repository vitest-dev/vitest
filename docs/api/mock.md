# Mock Functions

You can create a mock function to track its execution with `vi.fn` method. If you want to track a method on an already created object, you can use `vi.spyOn` method:

```js
import { vi } from 'vitest'

const fn = vi.fn()
fn('hello world')
fn.mock.calls[0] === ['hello world']

const market = {
  getApples: () => 100
}

const getApplesSpy = vi.spyOn(market, 'getApples')
market.getApples()
getApplesSpy.mock.calls.length === 1
```

You should use mock assertions (e.g., [`toHaveBeenCalled`](/api/expect#tohavebeencalled)) on [`expect`](/api/expect) to assert mock result. This API reference describes available properties and methods to manipulate mock behavior.

## getMockImplementation

- **Type:** `(...args: any) => any`

Returns current mock implementation if there is one.

If mock was created with [`vi.fn`](/api/vi#vi-fn), it will consider passed down method as a mock implementation.

If mock was created with [`vi.spyOn`](/api/vi#vi-spyon), it will return `undefined` unless a custom implementation was provided.

## getMockName

- **Type:** `() => string`

Use it to return the name given to mock with method `.mockName(name)`.

## mockClear

- **Type:** `() => MockInstance`

Clears all information about every call. After calling it, all properties on `.mock` will return empty state. This method does not reset implementations. It is useful if you need to clean up mock between different assertions.

If you want this method to be called before each test automatically, you can enable [`clearMocks`](/config/#clearmocks) setting in config.

## mockName

- **Type:** `(name: string) => MockInstance`

Sets internal mock name. Useful to see the name of the mock if assertion fails.

## mockImplementation

- **Type:** `(fn: Function) => MockInstance`

Accepts a function that will be used as an implementation of the mock.

```ts
const mockFn = vi.fn().mockImplementation(apples => apples + 1)
// or: vi.fn(apples => apples + 1);

const NelliesBucket = mockFn(0)
const BobsBucket = mockFn(1)

NelliesBucket === 1 // true
BobsBucket === 2 // true

mockFn.mock.calls[0][0] === 0 // true
mockFn.mock.calls[1][0] === 1 // true
```

## mockImplementationOnce

- **Type:** `(fn: Function) => MockInstance`

Accepts a function that will be used as mock's implementation during the next call. Can be chained so that multiple function calls produce different results.

```ts
const myMockFn = vi
  .fn()
  .mockImplementationOnce(() => true)
  .mockImplementationOnce(() => false)

myMockFn() // true
myMockFn() // false
```

When the mocked function runs out of implementations, it will invoke the default implementation that was set with `vi.fn(() => defaultValue)` or `.mockImplementation(() => defaultValue)` if they were called:

```ts
const myMockFn = vi
  .fn(() => 'default')
  .mockImplementationOnce(() => 'first call')
  .mockImplementationOnce(() => 'second call')

// 'first call', 'second call', 'default', 'default'
console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn())
```

## withImplementation

- **Type:** `(fn: Function, callback: () => void) => MockInstance`
- **Type:** `(fn: Function, callback: () => Promise<unknown>) => Promise<MockInstance>`

Overrides the original mock implementation temporarily while the callback is being executed.

```js
const myMockFn = vi.fn(() => 'original')

myMockFn.withImplementation(() => 'temp', () => {
  myMockFn() // 'temp'
})

myMockFn() // 'original'
```

Can be used with an asynchronous callback. The method has to be awaited to use the original implementation afterward.

```ts
test('async callback', () => {
  const myMockFn = vi.fn(() => 'original')

  // We await this call since the callback is async
  await myMockFn.withImplementation(
    () => 'temp',
    async () => {
      myMockFn() // 'temp'
    },
  )

  myMockFn() // 'original'
})
```

Note that this method takes precedence over the [`mockImplementationOnce`](https://vitest.dev/api/mock.html#mockimplementationonce).

## mockRejectedValue

- **Type:** `(value: any) => MockInstance`

Accepts an error that will be rejected when async function is called.

```ts
const asyncMock = vi.fn().mockRejectedValue(new Error('Async error'))

await asyncMock() // throws "Async error"
```

## mockRejectedValueOnce

- **Type:** `(value: any) => MockInstance`

Accepts a value that will be rejected during the next function call. If chained, every consecutive call will reject specified value.

```ts
const asyncMock = vi
  .fn()
  .mockResolvedValueOnce('first call')
  .mockRejectedValueOnce(new Error('Async error'))

await asyncMock() // first call
await asyncMock() // throws "Async error"
```

## mockReset

- **Type:** `() => MockInstance`

Does what `mockClear` does and makes inner implementation an empty function (returning `undefined` when invoked). This also resets all "once" implementations. This is useful when you want to completely reset a mock to the default state.

If you want this method to be called before each test automatically, you can enable [`mockReset`](/config/#mockreset) setting in config.

## mockRestore

- **Type:** `() => MockInstance`

Does what `mockReset` does and restores inner implementation to the original function.

Note that restoring mock from `vi.fn()` will set implementation to an empty function that returns `undefined`. Restoring a `vi.fn(impl)` will restore implementation to `impl`.

If you want this method to be called before each test automatically, you can enable [`restoreMocks`](/config/#restoreMocks) setting in config.

## mockResolvedValue

- **Type:** `(value: any) => MockInstance`

Accepts a value that will be resolved when async function is called.

```ts
const asyncMock = vi.fn().mockResolvedValue(42)

await asyncMock() // 42
```

## mockResolvedValueOnce

- **Type:** `(value: any) => MockInstance`

Accepts a value that will be resolved during the next function call. If chained, every consecutive call will resolve specified value.

```ts
const asyncMock = vi
  .fn()
  .mockResolvedValue('default')
  .mockResolvedValueOnce('first call')
  .mockResolvedValueOnce('second call')

await asyncMock() // first call
await asyncMock() // second call
await asyncMock() // default
await asyncMock() // default
```

## mockReturnThis

- **Type:** `() => MockInstance`

Use this if you need to return `this` context from the method without invoking actual implementation. This is a shorthand for:

```ts
spy.mockImplementation(function () {
  return this
})
```

## mockReturnValue

- **Type:** `(value: any) => MockInstance`

Accepts a value that will be returned whenever the mock function is called.

```ts
const mock = vi.fn()
mock.mockReturnValue(42)
mock() // 42
mock.mockReturnValue(43)
mock() // 43
```

## mockReturnValueOnce

- **Type:** `(value: any) => MockInstance`

Accepts a value that will be returned during the next function call. If chained, every consecutive call will return the specified value.

When there are no more `mockReturnValueOnce` values to use, mock will fallback to previously defined implementation if there is one.

```ts
const myMockFn = vi
  .fn()
  .mockReturnValue('default')
  .mockReturnValueOnce('first call')
  .mockReturnValueOnce('second call')

// 'first call', 'second call', 'default', 'default'
console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn())
```

## mock.calls

This is an array containing all arguments for each call. One item of the array is the arguments of that call.

```js
const fn = vi.fn()

fn('arg1', 'arg2')
fn('arg3')

fn.mock.calls === [
  ['arg1', 'arg2'], // first call
  ['arg3'], // second call
]
```

## mock.lastCall

This contains the arguments of the last call. If mock wasn't called, will return `undefined`.

## mock.results

This is an array containing all values that were `returned` from the function. One item of the array is an object with properties `type` and `value`. Available types are:

- `'return'` - function returned without throwing.
- `'throw'` - function threw a value.

The `value` property contains the returned value or thrown error. If the function returned a promise, the `value` will be the _resolved_ value, not the actual `Promise`, unless it was never resolved.

```js
const fn = vi.fn()
  .mockReturnValueOnce('result')
  .mockImplementationOnce(() => { throw new Error('thrown error') })

const result = fn() // returned 'result'

try {
  fn() // threw Error
}
catch {}

fn.mock.results === [
  // first result
  {
    type: 'return',
    value: 'result',
  },
  // last result
  {
    type: 'throw',
    value: Error,
  },
]
```

## mock.invocationCallOrder

The order of mock's execution. This returns an array of numbers that are shared between all defined mocks.

```js
const fn1 = vi.fn()
const fn2 = vi.fn()

fn1()
fn2()
fn1()

fn1.mock.invocationCallOrder === [1, 3]
fn2.mock.invocationCallOrder === [2]
```

## mock.instances

This is an array containing all instances that were instantiated when mock was called with a `new` keyword. Note that this is an actual context (`this`) of the function, not a return value.

::: warning
If mock was instantiated with `new MyClass()`, then `mock.instances` will be an array with one value:

```js
const MyClass = vi.fn()
const a = new MyClass()

MyClass.mock.instances[0] === a
```

If you return a value from constructor, it will not be in `instances` array, but instead inside `results`:

```js
const Spy = vi.fn(() => ({ method: vi.fn() }))
const a = new Spy()

Spy.mock.instances[0] !== a
Spy.mock.results[0] === a
```
:::
