# Multiple Setups

Since Vitest 3, you can specify several different browser setups using the new [`browser.configs`](/guide/browser/config#browser-configs) option.

The main advatage of using the `browser.configs` over the [workspace](/guide/workspace) is improved caching. Every project will use the same Vite server meaning the file transform and [dependency pre-bundling](https://vite.dev/guide/dep-pre-bundling.html) has to happen only once.

## Several Browsers

You can use the `browser.configs` field to specify options for different browsers. For example, if you want to run the same tests in different browsers, the minimal configuration will look like this:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      configs: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
})
```

## Different Setups

You can also specify different config options independently from the browser (although, the configs _can_ also have `browser` fields):

::: code-group
```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      configs: [
        {
          browser: 'chromium',
          name: 'chromium-1',
          setupFiles: ['./ratio-setup.ts'],
          provide: {
            ratio: 1,
          }
        },
        {
          browser: 'chromium',
          name: 'chromium-2',
          provide: {
            ratio: 2,
          }
        },
      ],
    },
  },
})
```
```ts [example.test.ts]
import { expect, inject, test } from 'vitest'
import { globalSetupModifier } from './example.js'

test('ratio works', () => {
  expect(inject('ratio') * globalSetupModifier).toBe(14)
})
```
:::

In this example Vitest will run all tests in `chromium` browser, but execute a `'./ratio-setup.ts'` file only in the first configuration and inject a different `ratio` value depending on the [`provide` field](/config/#provide).

::: warning
Note that you need to define the custom `name` value if you are using the same browser name because Vitest will assign the `browser` as the project name otherwise.
:::

## Filtering

You can filter what projects to run with the [`--project` flag](/guide/cli#project). Vitest will automatically assign the browser name as a project name if it is not assigned manually. If the root config already has a name, Vitest will merge them: `custom` -> `custom (browser)`.

```shell
$ vitest --project=chromium
```

::: code-group
```ts{6,8} [default]
export default defineConfig({
  test: {
    browser: {
      configs: [
        // name: chromium
        { browser: 'chromium' },
        // name: custom
        { browser: 'firefox', name: 'custom' },
      ]
    }
  }
})
```
```ts{3,7,9} [custom]
export default defineConfig({
  test: {
    name: 'custom',
    browser: {
      configs: [
        // name: custom (chromium)
        { browser: 'chromium' },
        // name: manual
        { browser: 'firefox', name: 'manual' },
      ]
    }
  }
})
```
:::

::: warning
Vitest cannot run multiple configs that have `headless` mode set to `false` (the default behaviour). During development, you can select what project to run in your terminal:

```shell
? Found multiple projects that run browser tests in headed mode: "chromium", "firefox".
Vitest cannot run multiple headed browsers at the same time. Select a single project
to run or cancel and run tests with "headless: true" option. Note that you can also
start tests with --browser=name or --project=name flag. › - Use arrow-keys. Return to submit.
❯   chromium
    firefox
```

If you have several non-headless projects in CI (i.e. the `headless: false` is set manually in the config and not overriden in  CI env), Vitest will fail the run and won't start any tests.

The ability to run tests in headless mode is not affected by this. You can still run all configs in parallel as long as they don't have `headless: false`.
:::
