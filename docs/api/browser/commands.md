---
title: Commands | Browser Mode
outline: deep
---

# Commands

Command is a function that invokes another function on the server and passes down the result back to the browser. Vitest exposes several built-in commands you can use in your browser tests.

## Built-in Commands

### Files Handling

You can use the `readFile`, `writeFile`, and `removeFile` APIs to handle files in your browser tests. Since Vitest 3.2, all paths are resolved relative to the [project](/guide/projects) root (which is `process.cwd()`, unless overridden manually). Previously, paths were resolved relative to the test file.

By default, Vitest uses `utf-8` encoding but you can override it with options.

::: tip
The built-in file commands follow Vite's [`server.fs`](https://vitejs.dev/config/server-options.html#server-fs-allow) restrictions for security reasons.

`writeFile` and `removeFile` also require write access through [`browser.api.allowWrite`](/config/browser/api) and [`api.allowWrite`](/config/api#api-allowwrite).
:::

```ts
import { server } from 'vitest/browser'

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

Vitest exposes access to raw Chrome DevTools Protocol via the `cdp` method exported from `vitest/browser`. It is mostly useful to library authors to build tools on top of it.

```ts
import { cdp } from 'vitest/browser'

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

CDP is a privileged debugging API. It is available only when browser API write and exec operations are enabled through [`browser.api.allowWrite`](/config/browser/api#api-allowwrite), [`browser.api.allowExec`](/config/browser/api#api-allowexec), [`api.allowWrite`](/config/api#api-allowwrite), and [`api.allowExec`](/config/api#api-allowexec).
:::

## Custom Commands

You can also add your own commands via [`browser.commands`](/config/browser/commands) config option. If you develop a library, you can provide them via a `config` hook inside a plugin:

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

Then you can call it inside your test by importing it from `vitest/browser`:

```ts
import { commands } from 'vitest/browser'
import { expect, test } from 'vitest'

test('custom command works correctly', async () => {
  const result = await commands.myCustomCommand('test1', 'test2')
  expect(result).toEqual({ someValue: true })
})

// if you are using TypeScript, you can augment the module
declare module 'vitest/browser' {
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

::: warning Security
Custom commands run in the Vitest Node process and are callable from browser test code through Vitest's browser RPC connection. They can access local files, environment variables, network services, databases, shell commands, and other Node APIs.

Vitest's built-in file commands validate paths against Vite's [`server.fs`](https://vite.dev/config/server-options#server-fs-allow) restrictions and separately check whether writes are allowed. Custom commands do not automatically inherit these protections. If a custom command accepts browser-provided input and uses it to read, write, delete, execute, or expose local resources, validate that input before using it.

For file reads or fixture loading, use `isFileLoadingAllowed` from `vitest/node` or an explicit allowlist. For writes and deletes, also require an explicit mutation policy, such as [`browser.api.allowWrite`](/config/browser/api#api-allowwrite), [`api.allowWrite`](/config/api#api-allowwrite), and a command-specific allowed directory. For commands that execute code, shell commands, or project scripts, also check [`browser.api.allowExec`](/config/browser/api#api-allowexec) and [`api.allowExec`](/config/api#api-allowexec).

For example, if you create your own file-writing command instead of using Vitest's built-in `writeFile`, apply the same checks:

```ts
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { normalizePath } from 'vite'
import { isFileLoadingAllowed } from 'vitest/node'
import type { BrowserCommand } from 'vitest/node'

function assertFileAccess(path: string, project: any) {
  if (
    !isFileLoadingAllowed(project.vite.config, path)
    && !isFileLoadingAllowed(project.vitest.vite.config, path)
  ) {
    throw new Error(`Access denied to "${path}".`)
  }
}

function assertWrite(project: any) {
  if (!project.config.browser.api.allowWrite || !project.vitest.config.api.allowWrite) {
    throw new Error('Writing files is disabled.')
  }
}

export const myWriteFileCommand: BrowserCommand<[path: string, content: string]> = async (
  { project },
  path,
  content,
) => {
  assertWrite(project)

  const file = resolve(project.config.root, path)
  assertFileAccess(normalizePath(file), project)

  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, content)
}
```

:::

### Recording trace markers

Custom commands can record [trace markers](/api/browser/context#mark) for the test that triggered them through `context.mark`. This is the server-side equivalent of `page.mark` and helps annotate the [trace view](/guide/browser/trace-view) with custom actions performed inside a command.

```ts
import type { BrowserCommand } from 'vitest/node'

export const uploadFixture: BrowserCommand<[name: string]> = async (
  context,
  name,
) => {
  await context.mark(`upload start: ${name}`, { kind: 'action' })
  // ... do server-side work
  await context.mark(`upload done: ${name}`, { kind: 'action' })
}
```

`context.mark` is a no-op when browser tracing is not enabled or no test is currently running in the session. Unlike `page.mark`, it does not accept a callback form.

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

### Custom `webdriverio` commands

Vitest exposes some `webdriverio` specific properties on the context object.

- `browser` is the `WebdriverIO.Browser` API.

Vitest automatically switches the `webdriver` context to the test iframe by calling `browser.switchFrame` before the command is called, so `$` and `$$` methods refer to the elements inside the iframe, not in the orchestrator, but non-webdriver APIs will still refer to the parent frame context.
