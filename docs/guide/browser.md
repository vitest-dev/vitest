---
title: Browser Mode | Guide
---

# Browser Mode <Badge type="warning">Experimental</Badge> {#browser-mode}

This page provides information about the experimental browser mode feature in the Vitest API, which allows you to run your tests in the browser natively, providing access to browser globals like window and document. This feature is currently under development, and APIs may change in the future.

## Installation

By default, Browser Mode doesn't require any additional E2E provider to run tests locally because it reuses your existing browser.

::: code-group
```bash [npm]
npm install -D vitest @vitest/browser
```
```bash [yarn]
yarn add -D vitest @vitest/browser
```
```bash [pnpm]
pnpm add -D vitest @vitest/browser
```
```bash [bun]
bun add -D vitest @vitest/browser
```
:::

::: warning
However, to run tests in CI you need to install either [`playwright`](https://npmjs.com/package/playwright) or [`webdriverio`](https://www.npmjs.com/package/webdriverio). We also recommend switching to either one of them for testing locally instead of using the default `preview` provider since it relies on simulating events instead of using Chrome DevTools Protocol.
:::

### Using Playwright

::: code-group
```bash [npm]
npm install -D vitest @vitest/browser playwright
```
```bash [yarn]
yarn add -D vitest @vitest/browser playwright
```
```bash [pnpm]
pnpm add -D vitest @vitest/browser playwright
```
```bash [bun]
bun add -D vitest @vitest/browser playwright
```
:::

### Using Webdriverio

::: code-group
```bash [npm]
npm install -D vitest @vitest/browser webdriverio
```
```bash [yarn]
yarn add -D vitest @vitest/browser webdriverio
```
```bash [pnpm]
pnpm add -D vitest @vitest/browser webdriverio
```
```bash [bun]
bun add -D vitest @vitest/browser webdriverio
```
:::

## Configuration

To activate browser mode in your Vitest configuration, you can use the `--browser` flag or set the `browser.enabled` field to `true` in your Vitest configuration file. Here is an example configuration using the browser field:

```ts
export default defineConfig({
  test: {
    browser: {
      provider: 'playwright', // or 'webdriverio'
      enabled: true,
      name: 'chrome', // browser name is required
    },
  }
})
```

## Browser Option Types

The browser option in Vitest depends on the provider. Vitest will fail, if you pass `--browser` and don't specify its name in the config file. Available options:

- `webdriverio` supports these browsers:
  - `firefox`
  - `chrome`
  - `edge`
  - `safari`
- `playwright` supports these browsers:
  - `firefox`
  - `webkit`
  - `chromium`

## Browser Compatibility

Vitest uses [Vite dev server](https://vitejs.dev/guide/#browser-support) to run your tests, so we only support features specified in the [`esbuild.target`](https://vitejs.dev/config/shared-options.html#esbuild) option (`esnext` by default).

By default, Vite targets browsers which support the native [ES Modules](https://caniuse.com/es6-module), native [ESM dynamic import](https://caniuse.com/es6-module-dynamic-import), and [`import.meta`](https://caniuse.com/mdn-javascript_operators_import_meta). On top of that, we utilize [`BroadcastChannel`](https://caniuse.com/?search=BroadcastChannel) to communicate between iframes:

- Chrome >=87
- Firefox >=78
- Safari >=15.4
- Edge >=88

## Motivation

We developed the Vitest browser mode feature to help improve testing workflows and achieve more accurate and reliable test results. This experimental addition to our testing API allows developers to run tests in a native browser environment. In this section, we'll explore the motivations behind this feature and its benefits for testing.

### Different Ways of Testing

There are different ways to test JavaScript code. Some testing frameworks simulate browser environments in Node.js, while others run tests in real browsers. In this context, [jsdom](https://www.npmjs.com/package/jsdom) is an example of a spec implementation that simulates a browser environment by being used with a test runner like Jest or Vitest, while other testing tools such as [WebdriverIO](https://webdriver.io/) or [Cypress](https://www.cypress.io/) allow developers to test their applications in a real browser or in case of [Playwright](https://playwright.dev/) provide you a browser engine.

### The Simulation Caveat

Testing JavaScript programs in simulated environments such as jsdom or happy-dom has simplified the test setup and provided an easy-to-use API, making them suitable for many projects and increasing confidence in test results. However, it is crucial to keep in mind that these tools only simulate a browser environment and not an actual browser, which may result in some discrepancies between the simulated environment and the real environment. Therefore, false positives or negatives in test results may occur.

To achieve the highest level of confidence in our tests, it's crucial to test in a real browser environment. This is why we developed the browser mode feature in Vitest, allowing developers to run tests natively in a browser and gain more accurate and reliable test results. With browser-level testing, developers can be more confident that their application will work as intended in a real-world scenario.

## Drawbacks

When using Vitest browser, it is important to consider the following drawbacks:

### Early Development

The browser mode feature of Vitest is still in its early stages of development. As such, it may not yet be fully optimized, and there may be some bugs or issues that have not yet been ironed out. It is recommended that users augment their Vitest browser experience with a standalone browser-side test runner like WebdriverIO, Cypress or Playwright.

### Longer Initialization

Vitest browser requires spinning up the provider and the browser during the initialization process, which can take some time. This can result in longer initialization times compared to other testing patterns.

## Cross-Browser Testing

When you specify a browser name in the browser option, Vitest will try to run the specified browser using [WebdriverIO](https://webdriver.io/) by default, and then run the tests there. This feature makes cross-browser testing easy to use and configure in environments like a CI. If you don't want to use WebdriverIO, you can configure the custom browser provider by using `browser.provider` option.

To specify a browser using the CLI, use the `--browser` flag followed by the browser name, like this:

```sh
npx vitest --browser=chrome
```

Or you can provide browser options to CLI with dot notation:

```sh
npx vitest --browser.name=chrome --browser.headless
```

## Headless

Headless mode is another option available in the browser mode. In headless mode, the browser runs in the background without a user interface, which makes it useful for running automated tests. The headless option in Vitest can be set to a boolean value to enable or disable headless mode.

Here's an example configuration enabling headless mode:

```ts
export default defineConfig({
  test: {
    browser: {
      provider: 'playwright',
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

::: warning
Headless mode is not available by default. You need to use either [`playwright`](https://npmjs.com/package/playwright) or [`webdriverio`](https://www.npmjs.com/package/webdriverio) providers to enable this feature.
:::

## Context

Vitest exposes a context module via `@vitest/browser/context` entry point. As of 2.0, it exposes a small set of utilities that might be useful to you in tests.

```ts
export const server: {
  /**
   * Platform the Vitest server is running on.
   * The same as calling `process.platform` on the server.
   */
  platform: Platform
  /**
   * Runtime version of the Vitest server.
   * The same as calling `process.version` on the server.
   */
  version: string
  /**
   * Name of the browser provider.
   */
  provider: string
  /**
   * Name of the current browser.
   */
  browser: string
  /**
   * Available commands for the browser.
   */
  commands: BrowserCommands
}

/**
 * Handler for user interactions. The support is provided by the browser provider (`playwright` or `webdriverio`).
 * If used with `preview` provider, fallbacks to simulated events via `@testing-library/user-event`.
 * @experimental
 */
export const userEvent: {
  setup: () => UserEvent
  /**
   * Click on an element. Uses provider's API under the hood and supports all its options.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-click} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/click/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#click} testing-library API
   */
  click: (element: Element, options?: UserEventClickOptions) => Promise<void>
  /**
   * Triggers a double click event on an element. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-dblclick} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/doubleClick/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#dblClick} testing-library API
   */
  dblClick: (element: Element, options?: UserEventDoubleClickOptions) => Promise<void>
  /**
   * Choose one or more values from a select element. Uses provider's API under the hood.
   * If select doesn't have `multiple` attribute, only the first value will be selected.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-select-option} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/doubleClick/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/utility/#-selectoptions-deselectoptions} testing-library API
   */
  selectOptions: (
    element: Element,
    values: HTMLElement | HTMLElement[] | string | string[],
    options?: UserEventSelectOptions,
  ) => Promise<void>
  /**
   * Type text on the keyboard. If any input is focused, it will receive the text,
   * otherwise it will be typed on the document. Uses provider's API under the hood.
   * **Supports** [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard) (e.g., `{Shift}`) even with `playwright` and `webdriverio` providers.
   * @example
   * await userEvent.keyboard('foo') // translates to: f, o, o
   * await userEvent.keyboard('{{a[[') // translates to: {, a, [
   * await userEvent.keyboard('{Shift}{f}{o}{o}') // translates to: Shift, f, o, o
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-press} Playwright API
   * @see {@link https://webdriver.io/docs/api/browser/action#key-input-source} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/keyboard} testing-library API
   */
  keyboard: (text: string) => Promise<void>
  /**
   * Types text into an element. Uses provider's API under the hood.
   * **Supports** [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard) (e.g., `{Shift}`) even with `playwright` and `webdriverio` providers.
   * @example
   * await userEvent.type(input, 'foo') // translates to: f, o, o
   * await userEvent.type(input, '{{a[[') // translates to: {, a, [
   * await userEvent.type(input, '{Shift}{f}{o}{o}') // translates to: Shift, f, o, o
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-press} Playwright API
   * @see {@link https://webdriver.io/docs/api/browser/action#key-input-source} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/utility/#type} testing-library API
   */
  type: (element: Element, text: string, options?: UserEventTypeOptions) => Promise<void>
  /**
   * Removes all text from an element. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-clear} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/clearValue} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/utility/#clear} testing-library API
   */
  clear: (element: Element) => Promise<void>
  /**
   * Sends a `Tab` key event. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-press} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/keys} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#tab} testing-library API
   */
  tab: (options?: UserEventTabOptions) => Promise<void>
  /**
   * Hovers over an element. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-hover} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/moveTo/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#hover} testing-library API
   */
  hover: (element: Element, options?: UserEventHoverOptions) => Promise<void>
  /**
   * Moves cursor position to the body element. Uses provider's API under the hood.
   * By default, the cursor position is in the center (in webdriverio) or in some visible place (in playwright)
   * of the body element, so if the current element is already there, this will have no effect.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-hover} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/moveTo/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#hover} testing-library API
   */
  unhover: (element: Element, options?: UserEventHoverOptions) => Promise<void>
  /**
   * Fills an input element with text. This will remove any existing text in the input before typing the new value.
   * Uses provider's API under the hood.
   * This API is faster than using `userEvent.type` or `userEvent.keyboard`, but it **doesn't support** [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard) (e.g., `{Shift}`).
   * @example
   * await userEvent.fill(input, 'foo') // translates to: f, o, o
   * await userEvent.fill(input, '{{a[[') // translates to: {, {, a, [, [
   * await userEvent.fill(input, '{Shift}') // translates to: {, S, h, i, f, t, }
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-fill} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/setValue} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/utility/#type} testing-library API
   */
  fill: (element: Element, text: string, options?: UserEventFillOptions) => Promise<void>
  /**
   * Drags a source element on top of the target element. This API is not supported by "preview" provider.
   * @see {@link https://playwright.dev/docs/api/class-frame#frame-drag-and-drop} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/dragAndDrop/} WebdriverIO API
   */
  dragAndDrop: (source: Element, target: Element, options?: UserEventDragAndDropOptions) => Promise<void>
}

/**
 * Available commands for the browser.
 * A shortcut to `server.commands`.
 */
export const commands: BrowserCommands

export const page: {
  /**
   * Serialized test config.
   */
  config: ResolvedConfig
  /**
   * Change the size of iframe's viewport.
   */
  viewport: (width: number | string, height: number | string) => Promise<void>
  /**
   * Make a screenshot of the test iframe or a specific element.
   * @returns Path to the screenshot file.
   */
  screenshot: (options?: ScreenshotOptions) => Promise<string>
}
```

## Interactivity API

Vitest implements a subset of [`@testing-library/user-event`](https://testing-library.com/docs/user-event) APIs using [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) or [webdriver](https://www.w3.org/TR/webdriver/) APIs instead of faking events which makes the browser behaviour more reliable and consistent.

Almost every `userEvent` method inherits its provider options. To see all available options in your IDE, add `webdriver` or `playwright` types to your `tsconfig.json` file:

::: code-group
```json [playwright]
{
  "compilerOptions": {
    "types": [
      "@vitest/browser/providers/playwright"
    ]
  }
}
```
```json [webdriverio]
{
  "compilerOptions": {
    "types": [
      "@vitest/browser/providers/webdriverio"
    ]
  }
}
```
:::

### userEvent.click

- **Type:** `(element: Element, options?: UserEventClickOptions) => Promise<void>`

Clicks on an element. Inherits provider's options. Please refer to your provider's documentation for detailed explanaition about how this method works.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('clicks on an element', () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.click(logo)
})
```

References:

- [Playwright `locator.click` API](https://playwright.dev/docs/api/class-locator#locator-click)
- [WebdriverIO `element.click` API](https://webdriver.io/docs/api/element/click/)
- [testing-library `click` API](https://testing-library.com/docs/user-event/convenience/#click)

### userEvent.dblClick

- **Type:** `(element: Element, options?: UserEventDoubleClickOptions) => Promise<void>`

Triggers a double click event on an element

Please refer to your provider's documentation for detailed explanaition about how this method works.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('triggers a double click on an element', () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.dblClick(logo)
})
```

References:

- [Playwright `locator.dblclick` API](https://playwright.dev/docs/api/class-locator#locator-dblclick)
- [WebdriverIO `element.doubleClick` API](https://webdriver.io/docs/api/element/doubleClick/)
- [testing-library `dblClick` API](https://testing-library.com/docs/user-event/convenience/#dblClick)

### userEvent.fill

- **Type:** `(element: Element, text: string) => Promise<void>`

Fills an input/textarea/conteneditable element with text. This will remove any existing text in the input before typing the new value.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('update input', () => {
  const input = screen.getByRole('input')

  await userEvent.fill(input, 'foo') // input.value == foo
  await userEvent.fill(input, '{{a[[') // input.value == {{a[[
  await userEvent.fill(input, '{Shift}') // input.value == {Shift}
})
```

::: tip
This API is faster than using [`userEvent.type`](#userevent-type) or [`userEvent.keyboard`](#userevent-keyboard), but it **doesn't support** [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard) (e.g., `{Shift}{selectall}`).

We recommend using this API over [`userEvent.type`](#userevent-type) in situations when you don't need to enter special characters.
:::

References:

- [Playwright `locator.fill` API](https://playwright.dev/docs/api/class-locator#locator-fill)
- [WebdriverIO `element.setValue` API](https://webdriver.io/docs/api/element/setValue)
- [testing-library `type` API](https://testing-library.com/docs/user-event/utility/#type)

### userEvent.keyboard

- **Type:** `(text: string) => Promise<void>`

The `userEvent.keyboard` allows you to trigger keyboard strokes. If any input has a focus, it will type characters into that input. Otherwise, it will trigger keyboard events on the currently focused element (`document.body` if there are no focused elements).

This API supports [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard).

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('trigger keystrokes', () => {
  await userEvent.keyboard('foo') // translates to: f, o, o
  await userEvent.keyboard('{{a[[') // translates to: {, a, [
  await userEvent.keyboard('{Shift}{f}{o}{o}') // translates to: Shift, f, o, o
  await userEvent.keyboard('{a>5}') // press a without releasing it and trigger 5 keydown
  await userEvent.keyboard('{a>5/}') // press a for 5 keydown and then release it
})
```

References:

- [Playwright `locator.press` API](https://playwright.dev/docs/api/class-locator#locator-press)
- [WebdriverIO `action('key')` API](https://webdriver.io/docs/api/browser/action#key-input-source)
- [testing-library `type` API](https://testing-library.com/docs/user-event/utility/#type)

### userEvent.tab

- **Type:** `(options?: UserEventTabOptions) => Promise<void>`

Sends a `Tab` key event. This is a shorthand for `userEvent.keyboard('{tab}')`.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'
import '@testing-library/jest-dom' // adds support for "toHaveFocus"

test('tab works', () => {
  const [input1, input2] = screen.getAllByRole('input')

  expect(input1).toHaveFocus()

  await userEvent.tab()

  expect(input2).toHaveFocus()

  await userEvent.tab({ shift: true })

  expect(input1).toHaveFocus()
})
```

References:

- [Playwright `locator.press` API](https://playwright.dev/docs/api/class-locator#locator-press)
- [WebdriverIO `action('key')` API](https://webdriver.io/docs/api/browser/action#key-input-source)
- [testing-library `tab` API](https://testing-library.com/docs/user-event/convenience/#tab)

### userEvent.type

- **Type:** `(element: Element, text: string, options?: UserEventTypeOptions) => Promise<void>`

::: warning
If you don't rely on [special characters](https://testing-library.com/docs/user-event/keyboard) (e.g., `{shift}` or `{selectall}`), it is recommended to use [`userEvent.fill`](#userevent-fill) instead.
:::

The `type` method implements `@testing-library/user-event`'s [`type`](https://testing-library.com/docs/user-event/utility/#type) utility built on top of [`keyboard`](https://testing-library.com/docs/user-event/keyboard) API.

This function allows you to type characters into an input/textarea/conteneditable element. It supports [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard).

If you just need to press characters without an input, use [`userEvent.keyboard`](#userevent-keyboard) API.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('update input', () => {
  const input = screen.getByRole('input')

  await userEvent.type(input, 'foo') // input.value == foo
  await userEvent.type(input, '{{a[[') // input.value == foo{a[
  await userEvent.type(input, '{Shift}') // input.value == foo{a[
})
```

References:

- [Playwright `locator.press` API](https://playwright.dev/docs/api/class-locator#locator-press)
- [WebdriverIO `action('key')` API](https://webdriver.io/docs/api/browser/action#key-input-source)
- [testing-library `type` API](https://testing-library.com/docs/user-event/utility/#type)

### userEvent.clear

- **Type:** `(element: Element) => Promise<void>`

This method clear the input element content.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'
import '@testing-library/jest-dom' // adds support for "toHaveValue"

test('clears input', () => {
  const input = screen.getByRole('input')

  await userEvent.fill(input, 'foo')
  expect(input).toHaveValue('foo')

  await userEvent.clear(input)
  expect(input).toHaveValue('')
})
```

References:

- [Playwright `locator.clear` API](https://playwright.dev/docs/api/class-locator#locator-clear)
- [WebdriverIO `element.clearValue` API](https://webdriver.io/docs/api/element/clearValue)
- [testing-library `clear` API](https://testing-library.com/docs/user-event/utility/#clear)

### userEvent.selectOptions

- **Type:** `(element: Element, values: HTMLElement | HTMLElement[] | string | string[], options?: UserEventSelectOptions) => Promise<void>`

The `userEvent.selectOptions` allows selecting a value in a `<select>` element.

::: warning
If select element doesn't have [`multiple`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select#attr-multiple) attribute, Vitest will select only the first element in the array.

Unlike `@testing-library`, Vitest doesn't support [listbox](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/listbox_role) at the moment, but we plan to add support for it in the future.
:::

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'
import '@testing-library/jest-dom' // adds support for "toHaveValue"

test('clears input', () => {
  const select = screen.getByRole('select')

  await userEvent.selectOptions(select, 'Option 1')
  expect(select).toHaveValue('option-1')

  await userEvent.selectOptions(select, 'option-1')
  expect(select).toHaveValue('option-1')

  await userEvent.selectOptions(select, [
    screen.getByRole('option', { name: 'Option 1' }),
    screen.getByRole('option', { name: 'Option 2' }),
  ])
  expect(select).toHaveValue(['option-1', 'option-2'])
})
```

::: warning
`webdriverio` provider doesn't support selecting multiple elements because it doesn't provide API to do so.
:::

References:

- [Playwright `locator.selectOption` API](https://playwright.dev/docs/api/class-locator#locator-select-option)
- [WebdriverIO `element.selectByIndex` API](https://webdriver.io/docs/api/element/selectByIndex)
- [testing-library `selectOptions` API](https://testing-library.com/docs/user-event/utility/#-selectoptions-deselectoptions)

### userEvent.hover

- **Type:** `(element: Element, options?: UserEventHoverOptions) => Promise<void>`

This method moves the cursor position to selected element. Please refer to your provider's documentation for detailed explanaition about how this method works.

::: warning
If you are using `webdriverio` provider, the cursor will move to the center of the element by default.

If you are using `playwright` provider, the cursor moves to "some" visible point of the element.
:::

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('hovers logo element', () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.hover(logo)
})
```

References:

- [Playwright `locator.hover` API](https://playwright.dev/docs/api/class-locator#locator-hover)
- [WebdriverIO `element.moveTo` API](https://webdriver.io/docs/api/element/moveTo/)
- [testing-library `hover` API](https://testing-library.com/docs/user-event/convenience/#hover)

### userEvent.unhover

- **Type:** `(element: Element, options?: UserEventHoverOptions) => Promise<void>`

This works the same as [`userEvent.hover`](#userevent-hover), but moves the cursor to the `document.body` element instead.

::: warning
By default, the cursor position is in the center (in `webdriverio` provider) or in "some" visible place (in `playwright` provider) of the body element, so if the currently hovered element is already in the same position, this method will have no effect.
:::

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'

test('unhover logo element', () => {
  const logo = screen.getByRole('img', { name: /logo/ })

  await userEvent.unhover(logo)
})
```

References:

- [Playwright `locator.hover` API](https://playwright.dev/docs/api/class-locator#locator-hover)
- [WebdriverIO `element.moveTo` API](https://webdriver.io/docs/api/element/moveTo/)
- [testing-library `hover` API](https://testing-library.com/docs/user-event/convenience/#hover)

### userEvent.dragAndDrop

- **Type:** `(source: Element, target: Element, options?: UserEventDragAndDropOptions) => Promise<void>`

Drags the source element on top of the target element. Don't forget that the `source` element has to have the `draggable` attribute set to `true`.

```ts
import { userEvent } from '@vitest/browser/context'
import { screen } from '@testing-library/dom'
import '@testing-library/jest-dom' // adds support for "toHaveTextContent"

test('drag and drop works', async () => {
  const source = screen.getByRole('img', { name: /logo/ })
  const target = screen.getByTestId('logo-target')

  await userEvent.dragAndDrop(source, target)

  expect(target).toHaveTextContent('Logo is processed')
})
```

::: warning
This API is not supported by the `preview` provider.
:::

References:

- [Playwright `frame.dragAndDrop` API](https://playwright.dev/docs/api/class-frame#frame-drag-and-drop)
- [WebdriverIO `element.dragAndDrop` API](https://webdriver.io/docs/api/element/dragAndDrop/)

## Commands

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

## Custom Commands

You can also add your own commands via [`browser.commands`](/config/#browser-commands) config option. If you develop a library, you can provide them via a `config` hook inside a plugin:

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
- `frame` is the tester [iframe instance](https://playwright.dev/docs/api/class-frame). It has a simillar API to the page, but it doesn't support certain methods.
- `context` refers to the unique [BrowserContext](https://playwright.dev/docs/api/class-browsercontext).

```ts
import { defineCommand } from '@vitest/browser'

export const myCommand = defineCommand(async (ctx, arg1, arg2) => {
  if (ctx.provider.name === 'playwright') {
    const element = await ctx.frame.findByRole('alert')
    const screenshot = await element.screenshot()
    // do something with the screenshot
    return difference
  }
})
```

::: tip
If you are using TypeScript, don't forget to add `@vitest/browser/providers/playwright` to your `tsconfig` "compilerOptions.types" field to get autocompletion in the config and on `userEvent` and `page` options:

```json
{
  "compilerOptions": {
    "types": [
      "@vitest/browser/providers/playwright"
    ]
  }
}
```
:::

### Custom `webdriverio` commands

Vitest exposes some `webdriverio` specific properties on the context object.

- `browser` is the `WebdriverIO.Browser` API.

Vitest automatically switches the `webdriver` context to the test iframe by calling `browser.switchToFrame` before the command is called, so `$` and `$$` methods refer to the elements inside the iframe, not in the orchestrator, but non-webdriver APIs will still refer to the parent frame context.

::: tip
If you are using TypeScript, don't forget to add `@vitest/browser/providers/webdriverio` to your `tsconfig` "compilerOptions.types" field to get autocompletion:

```json
{
  "compilerOptions": {
    "types": [
      "@vitest/browser/providers/webdriverio"
    ]
  }
}
```
:::

## Limitations

### Thread Blocking Dialogs

When using Vitest Browser, it's important to note that thread blocking dialogs like `alert` or `confirm` cannot be used natively. This is because they block the web page, which means Vitest cannot continue communicating with the page, causing the execution to hang.

In such situations, Vitest provides default mocks with default returned values for these APIs. This ensures that if the user accidentally uses synchronous popup web APIs, the execution would not hang. However, it's still recommended for the user to mock these web APIs for better experience. Read more in [Mocking](/guide/mocking).
