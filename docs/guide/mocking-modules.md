# Mocking Modules

## Defining a Module

Before mocking a "module", we should define what it is. In Vitest context, the "module" is a file that exports something. Using [plugins](https://vite.dev/guide/api-plugin.html), any file can be turned into a JavaScript module. The "module object" is a namespace object that holds dynamic references to exported identifiers. Simply put, it's an object with exported methods and properties. In this example, `example.js` is a module that exports `method` and `variable`:

```js [example.js]
export function answer() {
  // ...
  return 42
}

export const variable = 'example'
```

The `exampleObject` here is a module object:

```js [example.test.js]
import * as exampleObject from './example.js'
```

The `exampleObject` will always exist even if you imported the example using named imports:

```js [example.test.js]
import { answer, variable } from './example.js'
```

You can only reference `exampleObject` outside the example module itself. For example, in a test.

## Mocking a Module

For the purpose of this guide, let's introduce some definitions.

- **Mocked module** is a module that was completely replaced with another one.
- **Spied module** is a mocked module, but its exported methods keep the original implementation. They can also be tracked.
- **Mocked export** is a module export, which invocations can be tracked.
- **Spied export** is a mocked export.

To mock a module completely, you can use the [`vi.mock` API](/api/vi#vi-mock). You can define a new module dynamically by providing a factory that returns a new module as a second argument:

```ts
import { vi } from 'vitest'

// The ./example.js module will be replaced with
// the result of a factory function, and the
// original ./example.js module will never be called
vi.mock(import('./example.js'), () => {
  return {
    answer() {
      // ...
      return 42
    },
    variable: 'mock',
  }
})
```

::: tip
Remember that you can call `vi.mock` in a [setup file](/config/#setupfiles) to apply the module mock in every test file automatically.
:::

::: tip
Note the usage of dynamic import: `import('./example.ts')`. Vitest will strip it before the code is executed, but it allows TypeScript to properly validate the string and type the `importOriginal` method in your IDE or CLI.
:::

If your code is trying to access a method that was not returned from this factory, Vitest will throw an error with a helpful message. Note that `answer` is not mocked, i.e. it cannot be tracked. To make it trackable, use `vi.fn()` instead:

```ts
import { vi } from 'vitest'

vi.mock(import('./example.js'), () => {
  return {
    answer: vi.fn(),
    variable: 'mock',
  }
})
```

The factory method accepts an `importOriginal` function that will execute the original module and return its module object:

```ts
import { expect, vi } from 'vitest'
import { answer } from './example.js'

vi.mock(import('./example.js'), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    answer: vi.fn(originalModule.answer),
    variable: 'mock',
  }
})

expect(answer()).toBe(42)

expect(answer).toHaveBeenCalled()
expect(answer).toHaveReturned(42)
```

::: warning
Note that `importOriginal` is asynchronous and needs to be awaited.
:::

In the above example, we provided the original `answer` to the `vi.fn()` call so it can keep calling it while being tracked at the same time.

If you require the use of `importOriginal`, consider spying on the export directly via another API: `vi.spyOn`. Instead of replacing the whole module, you can spy only on a single exported method. To do that, you need to import the module as a namespace object:

```ts
import { expect, vi } from 'vitest'
import * as exampleObject from './example.js'

const spy = vi.spyOn(exampleObject, 'answer').mockReturnValue(0)

expect(exampleObject.answer()).toBe(0)
expect(exampleObject.answer).toHaveBeenCalled()
```

::: danger Browser Mode Support
This will not work in the [Browser Mode](/guide/browser/) because it uses the browser's native ESM support to serve modules. The module namespace object is sealed and can't be reconfigured. To bypass this limitation, Vitest supports `{ spy: true }` option in `vi.mock('./example.js')`. This will automatically spy on every export in the module without replacing them with fake ones.

```ts
import { vi } from 'vitest'
import * as exampleObject from './example.js'

vi.mock('./example.js', { spy: true })

vi.mocked(exampleObject.answer).mockReturnValue(0)
```
:::

::: warning
You only need to import the module as a namespace object in the file where you are using the `vi.spyOn` utility. If the `answer` is called in another file and is imported there as a named export, Vitest will be able to properly track it as long as the function that called it is called after `vi.spyOn`:

```ts [source.js]
import { answer } from './example.js'

export function question() {
  if (answer() === 42) {
    return 'Ultimate Question of Life, the Universe, and Everything'
  }

  return 'Unknown Question'
}
```
:::

Note that `vi.spyOn` will only spy on calls that were done after it spied on the method. So, if the function is executed at the top level during an import or it was called before the spying, `vi.spyOn` will not be able to report on it.

To automatically mock any module before it is imported, you can call `vi.mock` with a path:

```ts
import { vi } from 'vitest'

vi.mock(import('./example.js'))
```

If the file `./__mocks__/example.js` exists, then Vitest will load it instead. Otherwise, Vitest will load the original module and replace everything recursively:

- All arrays will be empty
- All primitives will stay untouched
- All getters will return `undefined`
- All methods will return `undefined`
- All objects will be deeply cloned
- All instances of classes and their prototypes will be cloned

To disable this behavior, you can pass down `spy: true` as the second argument:

```ts
import { vi } from 'vitest'

vi.mock(import('./example.js'), { spy: true })
```

Instead of returning `undefined`, all methods will call the original implementation, but you can still keep track of these calls:

```ts
import { expect, vi } from 'vitest'
import { answer } from './example.js'

vi.mock(import('./example.js'), { spy: true })

// calls the original implementation
expect(answer()).toBe(42)
// vitest can still track the invocations
expect(answer).toHaveBeenCalled()
```

One nice thing that mocked modules support is sharing the state between the instance and its prototype. Consider this module:

```ts [answer.js]
export class Answer {
  constructor(value) {
    this._value = value
  }

  value() {
    return this._value
  }
}
```

By mocking it, we can keep track of every invocation of `.value()` even without having access to the instance itself:

```ts [answer.test.js]
import { expect, test, vi } from 'vitest'
import { Answer } from './answer.js'

vi.mock(import('./answer.js'), { spy: true })

test('instance inherits the state', () => {
  // these invocations could be private inside another function
  // that you don't have access to in your test
  const answer1 = new Answer(42)
  const answer2 = new Answer(0)

  expect(answer1.value()).toBe(42)
  expect(answer1.value).toHaveBeenCalled()
  // note that different instances have their own states
  expect(answer2.value).not.toHaveBeenCalled()

  expect(answer2.value()).toBe(0)

  // but the prototype state accumulates all calls
  expect(Answer.prototype.value).toHaveBeenCalledTimes(2)
  expect(Answer.prototype.value).toHaveReturned(42)
  expect(Answer.prototype.value).toHaveReturned(0)
})
```

This can be very useful to track calls to instances that are never exposed.

## Mocking Non-existing Module

Vitest supports mocking virtual modules. These modules don't exist on the file system, but your code imports them. For example, this can happen when your development environment is different from production. One common example is mocking `vscode` APIs in your unit tests.

By default, Vitest will fail transforming files if it cannot find the source of the import. To bypass this, you need to specify it in your config. You can either always redirect the import to a file, or just signal Vite to ignore it and use the `vi.mock` factory to define its exports.

To redirect the import, use [`test.alias`](/config/#alias) config option:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    alias: {
      vscode: resolve(import.meta.dirname, './mock/vscode.js'),
    },
  },
})
```

To mark the module as always resolved, return the same string from `resolveId` hook of a plugin:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    {
      name: 'virtual-vscode',
      resolveId(id) {
        if (id === 'vscode') {
          return 'vscode'
        }
      }
    }
  ]
})
```

Now you can use `vi.mock` as usual in your tests:

```ts
import { vi } from 'vitest'

vi.mock(import('vscode'), () => {
  return {
    window: {
      createOutputChannel: vi.fn(),
    }
  }
})
```

## How it Works

Vitest implements different module mocking mechanisms depending on the environment. The only feature they share is the plugin transformer. When Vitest sees that a file has `vi.mock` inside, it will transform every static import into a dynamic one and move the `vi.mock` call to the top of the file. This allows Vitest to register the mock before the import happens without breaking the ESM rule of hoisted imports.

::: code-group
```ts [example.js]
import { answer } from './answer.js'

vi.mock(import('./answer.js'))

console.log(answer)
```
```ts [example.transformed.js]
vi.mock('./answer.js')

const __vitest_module_0__ = await __handle_mock__(
  () => import('./answer.js')
)
// to keep the live binding, we have to access
// the export on the module namespace
console.log(__vitest_module_0__.answer())
```
:::

The `__handle_mock__` wrapper just makes sure the mock is resolved before the import is initiated, it doesn't modify the module in any way.

The module mocking plugins are available in the [`@vitest/mocker` package](https://github.com/vitest-dev/vitest/tree/main/packages/mocker).

### JSDOM, happy-dom, Node

When you run your tests in an emulated environment, Vitest creates a [module runner](https://vite.dev/guide/api-environment-runtimes.html#modulerunner) that can consume Vite code. The module runner is designed in such a way that Vitest can hook into the module evaluation and replace it with the mock, if it was registered. This means that Vitest runs your code in an ESM-like environment, but it doesn't use native ESM mechanism directly. This allows the test runner to bend the rules around ES Modules immutability, allowing users to call `vi.spyOn` on a seemingly ES Module.

### Browser Mode

Vitest uses native ESM in the Browser Mode. This means that we cannot replace the module so easily. Instead, Vitest intercepts the fetch request (via playwright's `page.route` or a Vite plugin API if using `preview` or `webdriverio`) and serves transformed code, if the module was mocked.

For example, if the module is automocked, Vitest can parse static exports and create a placeholder module:

::: code-group
```ts [answer.js]
export function answer() {
  return 42
}
```
```ts [answer.transformed.js]
function answer() {
  return 42
}

const __private_module__ = {
  [Symbol.toStringTag]: 'Module',
  answer: vi.fn(answer),
}

export const answer = __private_module__.answer
```
:::

The example is simplified for brevity, but the concept is unchanged. We can inject a `__private_module__` variable into the module to hold the mocked values. If the user called `vi.mock` with `spy: true`, we pass down the original value; otherwise, we create a simple `vi.fn()` mock.

If user defined a custom factory, this makes it harder to inject the code, but not impossible. When the mocked file is served, we first resolve the factory in the browser, then pass down the keys back to the server, and use them to create a placeholder module:

```ts
const resolvedFactoryKeys = await resolveBrowserFactory(url)
const mockedModule = `
const __private_module__ = getFactoryReturnValue(${url})
${resolvedFactoryKeys.map(key => `export const ${key} = __private_module__["${key}"]`).join('\n')}
`
```

This module can now be served back to the browser. You can inspect the code in the devtools when you run the tests.

## Mocking Modules Pitfalls

Beware that it is not possible to mock calls to methods that are called inside other methods of the same file. For example, in this code:

```ts [foobar.js]
export function foo() {
  return 'foo'
}

export function foobar() {
  return `${foo()}bar`
}
```

It is not possible to mock the `foo` method from the outside because it is referenced directly. So this code will have no effect on the `foo` call inside `foobar` (but it will affect the `foo` call in other modules):

```ts [foobar.test.ts]
import { vi } from 'vitest'
import * as mod from './foobar.js'

// this will only affect "foo" outside of the original module
vi.spyOn(mod, 'foo')
vi.mock(import('./foobar.js'), async (importOriginal) => {
  return {
    ...await importOriginal(),
    // this will only affect "foo" outside of the original module
    foo: () => 'mocked'
  }
})
```

You can confirm this behavior by providing the implementation to the `foobar` method directly:

```ts [foobar.test.js]
import * as mod from './foobar.js'

vi.spyOn(mod, 'foo')

// exported foo references mocked method
mod.foobar(mod.foo)
```

```ts [foobar.js]
export function foo() {
  return 'foo'
}

export function foobar(injectedFoo) {
  return injectedFoo === foo // false
}
```

This is the intended behavior, and we do not plan to implement a workaround. Consider refactoring your code into multiple files or use techniques such as [dependency injection](https://en.wikipedia.org/wiki/Dependency_injection). We believe that making the application testable is not the responsibility of the test runner, but of the application architecture.
