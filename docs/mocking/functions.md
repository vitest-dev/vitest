# Functions

Mock functions (or "spies") observe functions, that are invoked in some other code, allowing you to test its arguments, output or even redeclare its implementation.

We use [Tinyspy](https://github.com/Aslemammad/tinyspy) as a base for mocking functions, but we have our own wrapper to make it `jest` compatible.

Both `vi.fn()` and `vi.spyOn()` share the same methods, but the return result of `vi.fn()` is callable.

## Configuration
All useful methods are located on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

## Example


## More

- [Jest's Mock Functions](https://jestjs.io/docs/mock-function-api)
