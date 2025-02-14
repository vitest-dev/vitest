---
title: Commands | Browser Mode
outline: deep
---

# Commands

Command is a function that invokes another function on the server and passes down the result back to the browser. Vitest exposes several built-in commands you can use in your browser tests.

## Built-in Commands

### Files Handling

You can use `readFile`, `writeFile` and `removeFile` API to handle files inside your browser tests. All paths are resolved relative to the test file even if they are called in a helper function located in another file.

By default, Vitest uses `utf-8` encoding but you can override it with options.

::: tip
This API follows [`server.fs`](https://vitejs.dev/config/server-options.html#server-fs-allow) limitations for security reasons.
:::

```ts
import { server } from '@vitest/browser/context'

const { readFile, writeFile, removeFile } = server.commands

it('handles files', async () => {
  const file = './test.txt'

  await writeFile(file, 'hello world')
  const content = await readFile(file)

  expect(content).toBe('hello world')

  await removeFile(file)
})
```

## CDP Session

Vitest exposes access to raw Chrome Devtools Protocol via the `cdp` method exported from `@vitest/browser/context`. It is mostly useful to library authors to build tools on top of it.

```ts
import { cdp } from '@vitest/browser/context'

const input = document.createElement('input')
document.body.appendChild(input)
input.focus()

await cdp().send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  text: 'a',
})

expect(input).toHaveValue('a')
```

::: warning
CDP session works only with `playwright` provider and only when using `chromium` browser. You can read more about it in playwright's [`CDPSession`](https://playwright.dev/docs/api/class-cdpsession) documentation.
:::

## Custom Commands

You can also add your own commands via [`browser.commands`](/guide/browser/config#browser-commands) config option. If you develop a library, you can provide them via a `config` hook inside a plugin:

```ts
import type { Plugin } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'

const myCustomCommand: BrowserCommand<[arg1: string, arg2: string]> = ({
  testPath,
  provider
}, arg1, arg2) => {
  if (provider.name === 'playwright') {
    console.log(testPath, arg1, arg2)
    return { someValue: true }
  }

  throw new Error(`provider ${provider.name} is not supported`)
}

export default function BrowserCommands(): Plugin {
  return {
    name: 'vitest:custom-commands',
    config() {
      return {
        test: {
          browser: {
            commands: {
              myCustomCommand,
            }
          }
        }
      }
    }
  }
}
```

Then you can call it inside your test by importing it from `@vitest/browser/context`:

```ts
import { commands } from '@vitest/browser/context'
import { expect, test } from 'vitest'

test('custom command works correctly', async () => {
  const result = await commands.myCustomCommand('test1', 'test2')
  expect(result).toEqual({ someValue: true })
})

// if you are using TypeScript, you can augment the module
declare module '@vitest/browser/context' {
  interface BrowserCommands {
    myCustomCommand: (arg1: string, arg2: string) => Promise<{
      someValue: true
    }>
  }
}
```

::: warning
Custom functions will override built-in ones if they have the same name.
:::

### Custom `playwright` commands

Vitest exposes several `playwright` specific properties on the command context.

- `page` references the full page that contains the test iframe. This is the orchestrator HTML and you most likely shouldn't touch it to not break things.
- `frame` is an async method that will resolve tester [`Frame`](https://playwright.dev/docs/api/class-frame). It has a similar API to the `page`, but it doesn't support certain methods. If you need to query an element, you should prefer using `context.iframe` instead because it is more stable and faster.
- `iframe` is a [`FrameLocator`](https://playwright.dev/docs/api/class-framelocator) that should be used to query other elements on the page.
- `context` refers to the unique [BrowserContext](https://playwright.dev/docs/api/class-browsercontext).

```ts
import { BrowserCommand } from 'vitest/node'

export const myCommand: BrowserCommand<[string, number]> = async (
  ctx,
  arg1: string,
  arg2: number
) => {
  if (ctx.provider.name === 'playwright') {
    const element = await ctx.iframe.findByRole('alert')
    const screenshot = await element.screenshot()
    // do something with the screenshot
    return difference
  }
}
```

::: tip
If you are using TypeScript, don't forget to reference `@vitest/browser/providers/playwright` in your [setup file](/config/#setupfile) or a [config file](/config/) to get autocompletion in the config and in `userEvent` and `page` options:

```ts
/// <reference types="@vitest/browser/providers/playwright" />
```
:::

### Custom `webdriverio` commands

Vitest exposes some `webdriverio` specific properties on the context object.

- `browser` is the `WebdriverIO.Browser` API.

Vitest automatically switches the `webdriver` context to the test iframe by calling `browser.switchToFrame` before the command is called, so `$` and `$$` methods refer to the elements inside the iframe, not in the orchestrator, but non-webdriver APIs will still refer to the parent frame context.

::: tip
If you are using TypeScript, don't forget to reference `@vitest/browser/providers/webdriverio` in your [setup file](/config/#setupfile) or a [config file](/config/) to get autocompletion:

```ts
/// <reference types="@vitest/browser/providers/webdriverio" />
```
:::
