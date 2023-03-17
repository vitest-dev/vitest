---
title: Browser mode | Guide
---

# Browser mode (experimental)

This document provides information about the experimental browser mode feature in the vitest API, which allows you to run your tests in the browser natively, providing access to browser globals like window and document. This feature is currently under development, and APIs may change in the future.

## Configuration

To activate browser mode in your vitest configuration, you can use the `--browser` flag or set the browser field to true in your vitest configuration file. Here is an example configuration using browser field:

```ts
export default defineConfig({
  test: {
    browser: true,
  }
})
```
Browser Option Types:

The browser option in vitest can be set to either a boolean or a string type. If
set to `true`, the users can navigate to the provided link by vitest. You can also specify a browser by providing its name as a string. The available browser options are:
- `firefox`
- `chrome`
- `edge`
- `safari`

Here's an example configuration setting chrome as the browser option:

```ts
export default defineConfig({
  test: {
    browser: 'chrome',
  }
})
```

## Cross-browser Testing:

When you specify a browser name in the browser option, vitest will try to run
the specified browser using [WebdriverIO](https://webdriver.io/), and then run the tests there. This
feature makes cross-browser testing easy to use and configure in environments
like CI.

To specify a browser using the CLI, use the `--browser` flag followed by the browser name, like this:

```sh
vitest --browser=chrome
```


> Note: When using the Safari browser option, the Safaridriver needs to be
> activated by running `sudo safaridriver --enable` on your device. Additionally, when running vitest, it will attempt to install some drivers for compatibility with safaridriver.

Headless mode is another option available in the browser mode. In headless mode, the browser runs in the background without a user interface, which makes it useful for running automated tests. The headless option in vitest can be set to a boolean value to enable or disable headless mode.

Here's an example configuration enabling headless mode:

```ts
export default defineConfig({
  test: {
    browser: true,
    headless: true,
  }
})
```

## Headless

You can also set headless mode using the `--headless` flag in the CLI, like this:

```sh
vitest --browser=chrome --headless
```

In this case, vitest will run in headless mode using the Chrome browser.

## Open

Another option available in the browser mode is the `open` option, which automatically opens your default browser when the browser option is set to true. This can be useful for quickly viewing your tests in the browser.

Here's an example configuration enabling the open option:

```ts
export default defineConfig({
  test: {
    browser: true,
    open: true,
  }
})
```

In this configuration, vitest will open your default browser and run the tests in the browser.
