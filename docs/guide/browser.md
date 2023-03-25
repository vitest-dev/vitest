---
title: Browser Mode | Guide
---

# Browser Mode (experimental)

This page provides information about the experimental browser mode feature in the Vitest API, which allows you to run your tests in the browser natively, providing access to browser globals like window and document. This feature is currently under development, and APIs may change in the future.

## Configuration

To activate browser mode in your Vitest configuration, you can use the `--browser` flag or set the `browser.enabled` field to `true` in your Vitest configuration file. Here is an example configuration using the browser field:

```ts
export default defineConfig({
  test: {
    browser: {
      enabled: true
    },
  }
})
```

## Browser Option Types:

The browser option in Vitest can be set to either a boolean or a string type. If set to `true`, Vitest will try to automatically find your default browser. You can also specify a browser by providing its name as a `string`. The available browser options are:
- `firefox`
- `chrome`
- `edge`
- `safari`

Here's an example configuration setting chrome as the browser option:

```ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chrome',
    },
  }
})
```

## Cross-browser Testing:

When you specify a browser name in the browser option, Vitest will try to run the specified browser using [WebdriverIO](https://webdriver.io/) by default, and then run the tests there. This feature makes cross-browser testing easy to use and configure in environments like a CI. If you don't want to use WebdriverIO, you can configure the custom browser provider by using `browser.provider` option.

To specify a browser using the CLI, use the `--browser` flag followed by the browser name, like this:

```sh
npx vitest --browser=chrome
```

Or you can provide browser options to CLI with dot notation:

```sh
npx vitest --browser.name=chrome --browser.headless
```

::: tip NOTE
When using the Safari browser option, the `safaridriver` needs to be activated by running `sudo safaridriver --enable` on your device.

Additionally, when running your tests, Vitest will attempt to install some drivers for compatibility with `safaridriver`.
:::

## Headless

Headless mode is another option available in the browser mode. In headless mode, the browser runs in the background without a user interface, which makes it useful for running automated tests. The headless option in Vitest can be set to a boolean value to enable or disable headless mode.

Here's an example configuration enabling headless mode:

```ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      headless: true,
    },
  }
})
```

You can also set headless mode using the `--browser.headless` flag in the CLI, like this:

```sh
npx vitest --browser.name=chrome --browser.headless
```

In this case, Vitest will run in headless mode using the Chrome browser.

## Limitations
### Thread Blocking Dialogs

When using Vitest Browser, it's important to note that thread blocking dialogs like `alert` or `confirm` cannot be used natively. This is because they block the web page, which means Vitest cannot continue communicating with the page, causing the execution to hang.

In such situations, Vitest provides default mocks with default returned values for these APIs. This ensures that if the user accidentally uses synchronous popup web APIs, the execution would not hang. However, it's still recommended for the user to mock these web APIs for better experience. Read more in [Mocking](/guide/mocking).
