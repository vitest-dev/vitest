# Mocking Modules

Vitest provides utility functions to mock modules. You can access them on `vi` object that you can import from `vitest` package or access globally, if you have [`global`](/config/#global) config enabled.

## Methods

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

## Automocking algorithm

If your code is importing mocked module, but there are no `__mocks__` file for this module or a `factory`, Vitest will mock the module itself by invoking it and mocking every export.

* All arrays will be emptied
* All primitives and collections will stay the same
* All objects will be deeply cloned
* All instances of classes and their prototypes will be deeply cloned