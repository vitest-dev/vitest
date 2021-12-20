# Mocking

## Mocking functions

Mock functions are also known as "spies", because they let you spy on the behavior of a function that is called indirectly by some other code, rather than only testing the output.

We use [Tinyspy](https://github.com/Aslemammad/tinyspy) as a base for mocking functions, but we have our own wrapper to make it `jest` compatible.

Both `vi.fn()` and `vi.spyOn()` share the same methods, but the return result of `vi.fn()` is callable.

### vi.fn

**Type:** `(fn: Function) => CallableMockInstance`

Creates a spy on a function, though can be initiated without a function. Every time a function is invocked, it stores call arguments, returns and instances. Also you can manipulate it's behaviour with methods.
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

Sets internal mock name. Usefull to see what mock has failed the assertion.

### getMockName

**Type:** `() => string`

Use it to return the name, given to mock with method `.mockName(name)`.

### mockClear

**Type:** `() => MockInstance`

Clears all information about every call. After calling it [`spy.mock.calls`](#mockcalls), [`spy.mock.returns`](#mockreturns) will return empty arrays. It is useful if you need to clean up spy between different assertions.

If you want this method to be called before each test automatically, you can enable [`clearMocks`](/config/#clearMocks) setting in config.

### mockReset

**Type:** `() => MockInstance`

Does what `mockClear` does and makes inner implementation as an epmty function, so it will always return `undefined`. This is useful when you want to completely reset a mock back to its initial state.

If you want this method to be called before each test automatically, you can enable [`mockReset`](/config/#mockReset) setting in config.

### mockRestore

**Type:** `() => MockInstance`

Does what `mockRestore` does and restores inner implementation to the original function.

Note that restoring mock from `vi.fn()` call will set implementation to an empty function that returns `undefined`. Restoring a `vi.fn(impl)` will restore implementation to `impl`.

This is useful when you want to mock functions in certain test cases and restore the original implementation in others.

If you want this method to be called before each test automatically, you can enable [`restoreMocks`](/config/#restoreMocks) setting in config.

### mockImplementation

**Type:** `(fn: Function) => MockInstance`

Accepts a function that should be used as the implementation of the mock. The mock itself will still record all calls that go into and instances that come from itself – the only difference is that the implementation will also be executed when the mock is called.

For example:

```ts
const mockFn = jest.fn().mockImplementation(scalar => 42 + scalar);
// or: jest.fn(scalar => 42 + scalar);

const a = mockFn(0);
const b = mockFn(1);

a === 42; // true
b === 43; // true

mockFn.mock.calls[0][0] === 0; // true
mockFn.mock.calls[1][0] === 1; // true
```

### mockImplementationOnce

**Type:** `(fn: Function) => MockInstance`

Accepts a function that will be used as an implementation of the mock for one call to the mocked function. Can be chained so that multiple function calls produce different results.

```ts
const myMockFn = jest
  .fn()
  .mockImplementationOnce(cb => cb(null, true))
  .mockImplementationOnce(cb => cb(null, false));

myMockFn((err, val) => console.log(val)); // true

myMockFn((err, val) => console.log(val)); // false
```

When the mocked function runs out of implementations defined with mockImplementationOnce, it will execute the default implementation set with `jest.fn(() => defaultValue)` or `.mockImplementation(() => defaultValue)` if they were called:

```ts
const myMockFn = jest
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
const mock = jest.fn();
mock.mockReturnValue(42);
mock(); // 42
mock.mockReturnValue(43);
mock(); // 43
```

### mockReturnValueOnce

**Type:** `(value: any) => MockInstance`

Accepts a value that will be returned for one call to the mock function. Can be chained so that successive calls to the mock function return different values. When there are no more `mockReturnValueOnce` values to use, calls a function specified by `mockImplementation`.

```ts
const myMockFn = jest
  .fn()
  .mockReturnValue('default')
  .mockReturnValueOnce('first call')
  .mockReturnValueOnce('second call');

// 'first call', 'second call', 'default', 'default'
console.log(myMockFn(), myMockFn(), myMockFn(), myMockFn());
```

### mockResolvedValue

**Type:** `(value: any) => MockInstance`

Accepts a value that will be resolved, when async function will be called. Useful to mock async functions in async tests:

```ts
test('async test', async () => {
  const asyncMock = jest.fn().mockResolvedValue(43);

  await asyncMock(); // 43
});
```

### mockResolvedValueOnce

**Type:** `(value: any) => MockInstance`

Accepts a value that will be resolved for one call to the mock function. Can be chained so that successive calls to the mock function resolve different values.

```ts
test('async test', async () => {
  const asyncMock = jest
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
  const asyncMock = jest.fn().mockRejectedValue(new Error('Async error'));

  await asyncMock(); // throws "Async error"
});
```

### mockRejectedValueOnce

**Type:** `(value: any) => MockInstance`

Accepts a value that will be rejected for one call to the mock function.

```ts
test('async test', async () => {
  const asyncMock = jest
    .fn()
    .mockResolvedValueOnce('first call')
    .mockRejectedValueOnce(new Error('Async error'));

  await asyncMock(); // first call
  await asyncMock(); // throws "Async error"
});
```

## Mock properties

### mock.calls

An array containing the call arguments of all calls that have been made to this mock function. Each item in the array is an array of arguments that were passed during the call.

For example: A mock function `f` that has been called twice, with the arguments `f('arg1', 'arg2')`, and then with the arguments `f('arg3', 'arg4')`, would have a mock.calls array that looks like this:

```js
[
  ['arg1', 'arg2'],
  ['arg3', 'arg4'],
];
```

### mock.results

An array containing the results of all calls that have been made to this mock function. Each entry in this array is an object containing a `type` property, and a `value` property. `type` will be one of the following:

- `'return'` - Indicates that the call completed by returning normally.
- `'throw'` - Indicates that the call completed by throwing a value.

The `value` property contains the value that was thrown or returned.

For example: A mock function `f` that has been called three times, returning `'result1'`, throwing an error, and then returning `'result2'`, would have a `mock.results` array that looks like this:

```js
[
  {
    type: 'return',
    value: 'result1',
  },
  {
    type: 'throw',
    value: {
      /* Error instance */
    },
  },
  {
    type: 'return',
    value: 'result2',
  },
];
```

### mock.instances

This property currently is not implemented.

## See also

- [Jest's Mock Functions](https://jestjs.io/docs/mock-function-api)