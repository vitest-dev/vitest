# @vitest/mocker

Module mocker parts that can be used independently from Vitest.

## Using as a Vite plugin

```ts
import { mockerPlugin } from '@vitest/mocker/node'

export default defineConfig({
  plugins: [mockerPlugin()],
})
```

```ts
// at the top of your entry point
import '@vitest/mocker/register'
```

## MockerRegistry

Just a cache that holds mocked modules to be used by the actual mocker.

```ts
import { ManualMockedModule, MockerRegistry } from '@vitest/mocker'
const registry = new MockerRegistry()

registry.register('manual', './id.js', '/users/custom/id.js', factory)
registry.get('/users/custom/id.js') instanceof ManualMockedModule
```

## mockObject

Deeply mock an object. This is the function that automocks modules in Vitest.

```ts
import { mockObject } from '@vitest/mocker'

mockObject(
  {
    // this is needed because it can be used in vm context
    globalContructors: {
      Object,
      // ...
    },
    // you can provide your own spyOn implementation
    spyOn,
    mockType: 'automock' // or 'autospy'
  },
  {
    myDeep: {
      object() {
        return {
          willAlso: {
            beMocked() {
              return true
            },
          },
        }
      },
    },
  }
)
```

## automockPlugin

The Vite plugin that can mock any module in the browser.

```ts
import { automockPlugin } from '@vitest/mocker/node'
import { createServer } from 'vite'

await createServer({
  plugins: [
    automockPlugin(),
  ],
})
```

Any module that has `mock=automock` or `mock=autospy` query will be mocked:

```ts
import { calculator } from './src/calculator.js?mock=automock'

calculator(1, 2)
calculator.mock.calls[0] === [1, 2]
```

Ideally, you would inject those queries somehow, not write them manually. In the future, this package will support `with { mock: 'auto' }` syntax.

> [!WARNING]
> The plugin expects a global `__vitest_mocker__` variable with a `mockObject` method. Make sure it is injected _before_ the mocked file is imported.

## automockModule

Replace every export with a mock in the code.

```ts
import { automockModule } from '@vitest/mocker/node'
import { parseAst } from 'vite'

const ms = await automockModule(
  `export function test() {}`,
  'automock',
  parseAst,
)
console.log(
  ms.toString(),
  ms.generateMap({ hires: 'boundary' })
)
```

Produces this:

```ts
function test() {}

const __vitest_es_current_module__ = {
  __esModule: true,
  test,
}
const __vitest_mocked_module__ = __vitest_mocker__.mockObject(__vitest_es_current_module__, 'automock')
const __vitest_mocked_0__ = __vitest_mocked_module__.test
export {
  __vitest_mocked_0__ as test,
}
```

## findMockRedirect

This method will try to find a file inside `__mocks__` folder that corresponds to the current file.

```ts
import { findMockRedirect } from '@vitest/mocker/node'

// uses sync fs APIs
const mockRedirect = findMockRedirect(
  root,
  'vscode',
  'vscode', // if defined, will assume the file is a library name
)
// mockRedirect == root/__mocks__/vscode.js
```
