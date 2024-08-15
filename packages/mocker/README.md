# @vitest/mocker

Vitest's module mocker implementation.

## Using as a Vite plugin

Make sure you have `vite`, `@vitest/spy` and `msw` installed.

```ts
import { mockerPlugin } from '@vitest/mocker/node'

export default defineConfig({
  plugins: [mockerPlugin()],
})
```

```ts
import { registerModuleMocker } from '@vitest/mocker/register'
import { mswWorker } from './msw-worker.js'
// you can pass down msw worker if you have a custom one
registerModuleMocker({ mswWorker })
```

```ts
// you can also just import "auto-register" at the top of your entry point
import '@vitest/mocker/auto-register'
```

To use the mocker now you will need compiler hints. You can create them with `createCompilerHints` function:

```ts
import { createCompilerHints } from '@vitest/mocker/browser'
const vi = createCompilerHints()
```

By default, Vitest looks for `vi.mock`/`vi.doMock`/`vi.unmock`/`vi.doUnmock`/`vi.hoisted`. You can configure this with the `hoistMocks` option when initiating a plugin:

```ts
import { mockerPlugin } from '@vitest/mocker/node'

export default defineConfig({
  plugins: [
    mockerPlugin({
      hoistMocks: {
        regexpHoistable: /myObj.mock/,
        // you will also need to update other options accordingly
        utilsObjectName: ['myObj'],
      },
    }),
  ],
})
```

Now you can call `vi.mock` in your code and the mocker should kick in automatially:

```ts
import { mocked } from './some-module.js'

vi.mock('./some-module.js', () => {
  return { mocked: true }
})

mocked === true
```

## MockerRegistry

Just a cache that holds mocked modules to be used by the actual mocker.

```ts
import { ManualMockedModule, MockerRegistry } from '@vitest/mocker'
const registry = new MockerRegistry()

// Vitest requites the original ID for better error messages,
// You can pass down anything related to the module there
registry.register('manual', './id.js', '/users/custom/id.js', factory)
registry.get('/users/custom/id.js') instanceof ManualMockedModule
```

## mockObject

Deeply mock an object. This is the function that automocks modules in Vitest.

```ts
import { mockObject } from '@vitest/mocker'
import { spyOn } from '@vitest/spy'

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
> The plugin expects a global `__vitest_mocker__` variable with a `mockObject` method. Make sure it is injected _before_ the mocked file is imported. You can also configure the accessor by changing the `globalThisAccessor` option.

> [!NOTE]
> This plugin is included in `mockerPlugin`.

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

## hoistMocksPlugin

The plugin that hoists every compiler hint, replaces every static import with dynamic one and updates exports access to make sure live-binding is not broken.

```ts
import { hoistMocksPlugin } from '@vitest/mocker/node'
import { createServer } from 'vite'

await createServer({
  plugins: [
    hoistMocksPlugin({
      hoistedModules: ['virtual:my-module'],
      regexpHoistable: /myObj.(mock|hoist)/,
      utilsObjectName: ['myObj'],
      hoistableMockMethodNames: ['mock'],
      // disable support for vi.mock(import('./path'))
      dynamicImportMockMethodNames: [],
      hoistedMethodNames: ['hoist'],
    }),
  ],
})
```

> [!NOTE]
> This plugin is included in `mockerPlugin`.

## hoistMocks

Hoist compiler hints, replace static imports with dynamic ones and update exports access to make sure live-binding is not broken.

This is required to ensure mocks are resolved before we import the user module.

```ts
import { parseAst } from 'vite'

hoistMocks(
  `
import { mocked } from './some-module.js'

vi.mock('./some-module.js', () => {
  return { mocked: true }
})

mocked === true
  `,
  '/my-module.js',
  parseAst
)
```

Produces this code:

```js
vi.mock('./some-module.js', () => {
  return { mocked: true }
})

const __vi_import_0__ = await import('./some-module.js')
__vi_import_0__.mocked === true
```

## dynamicImportPlugin

Wrap every dynamic import with `mocker.wrapDynamicImport`. This is required to ensure mocks are resolved before we import the user module. You can configure the `globalThis` accessor with `globalThisAccessor` option.

It doesn't make sense to use this plugin in isolation from other plugins.

```ts
import { dynamicImportPlugin } from '@vitest/mocker/node'
import { createServer } from 'vite'

await createServer({
  plugins: [
    dynamicImportPlugin({
      globalThisAccessor: 'Symbol.for("my-mocker")'
    }),
  ],
})
```

```ts
await import('./my-module.js')

// produces this:
await globalThis[`Symbol.for('my-mocker')`].wrapDynamicImport(() => import('./my-module.js'))
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
