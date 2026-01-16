---
title: browser.provider | Config
outline: deep
---

# browser.provider {#browser-provider}

- **Type:** `BrowserProviderOption`

The return value of the provider factory. You can import the factory from `@vitest/browser-<provider-name>` or make your own provider:

```ts{8-10}
import { playwright } from '@vitest/browser-playwright'
import { webdriverio } from '@vitest/browser-webdriverio'
import { preview } from '@vitest/browser-preview'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      provider: webdriverio(),
      provider: preview(),
    },
  },
})
```

To configure how provider initializes the browser, you can pass down options to the factory function:

```ts{7-13,20-26}
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      // shared provider options between all instances
      provider: playwright({
        launchOptions: {
          slowMo: 50,
          channel: 'chrome-beta',
        },
        actionTimeout: 5_000,
      }),
      instances: [
        { browser: 'chromium' },
        {
          browser: 'firefox',
          // overriding options only for a single instance
          // this will NOT merge options with the parent one
          provider: playwright({
            launchOptions: {
              firefoxUserPrefs: {
                'browser.startup.homepage': 'https://example.com',
              },
            },
          })
        }
      ],
    },
  },
})
```

## Custom Provider <Badge type="danger">advanced</Badge>

::: danger ADVANCED API
The custom provider API is highly experimental and can change between patches. If you just need to run tests in a browser, use the [`browser.instances`](#browser-instances) option instead.
:::

```ts
export interface BrowserProvider {
  name: string
  mocker?: BrowserModuleMocker
  readonly initScripts?: string[]
  /**
   * @experimental opt-in into file parallelisation
   */
  supportsParallelism: boolean
  getCommandsContext: (sessionId: string) => Record<string, unknown>
  openPage: (sessionId: string, url: string) => Promise<void>
  getCDPSession?: (sessionId: string) => Promise<CDPSession>
  close: () => Awaitable<void>
}
```
