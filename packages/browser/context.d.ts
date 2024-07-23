import type { SerializedConfig } from 'vitest'

export type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'utf-16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex'

export interface FsOptions {
  encoding?: BufferEncoding
  flag?: string | number
}

export interface CDPSession {
  // methods are defined by the provider type augmentation
}

export interface ScreenshotOptions {
  element?: Element
  /**
   * Path relative to the `screenshotDirectory` in the test config.
   */
  path?: string
  /**
   * Will also return the base64 encoded screenshot alongside the path.
   */
  base64?: boolean
}

export interface BrowserCommands {
  readFile: (
    path: string,
    options?: BufferEncoding | FsOptions
  ) => Promise<string>
  writeFile: (
    path: string,
    content: string,
    options?: BufferEncoding | (FsOptions & { mode?: number | string })
  ) => Promise<void>
  removeFile: (path: string) => Promise<void>
}

export interface UserEvent {
  /**
   * Creates a new user event instance. This is useful if you need to keep the
   * state of keyboard to press and release buttons correctly.
   *
   * **Note:** Unlike `@testing-library/user-event`, the default `userEvent` instance
   * from `@vitest/browser/context` is created once, not every time its methods are called!
   * @see {@link https://vitest.dev/guide/browser/interactivity-api.html#userevent-setup}
   */
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
   * Triggers a triple click event on an element. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-click} Playwright API: using `click` with `clickCount: 3`
   * @see {@link https://webdriver.io/docs/api/browser/actions/} WebdriverIO API: using actions api with `move` plus three `down + up + pause` events in a row
   * @see {@link https://testing-library.com/docs/user-event/convenience/#tripleclick} testing-library API
   */
  tripleClick: (element: Element, options?: UserEventTripleClickOptions) => Promise<void>
  /**
   * Choose one or more values from a select element. Uses provider's API under the hood.
   * If select doesn't have `multiple` attribute, only the first value will be selected.
   * @example
   * await userEvent.selectOptions(select, 'Option 1')
   * expect(select).toHaveValue('option-1')
   *
   * await userEvent.selectOptions(select, 'option-1')
   * expect(select).toHaveValue('option-1')
   *
   * await userEvent.selectOptions(select, [
   *  screen.getByRole('option', { name: 'Option 1' }),
   *  screen.getByRole('option', { name: 'Option 2' }),
   * ])
   * expect(select).toHaveValue(['option-1', 'option-2'])
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
   * @see {@link https://playwright.dev/docs/api/class-keyboard} Playwright API
   * @see {@link https://webdriver.io/docs/api/browser/keys} WebdriverIO API
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
   * @see {@link https://playwright.dev/docs/api/class-keyboard} Playwright API
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
   * Fills an input element with text. This will remove any existing text in the input before typing the new text.
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

export interface UserEventFillOptions {}
export interface UserEventHoverOptions {}
export interface UserEventSelectOptions {}
export interface UserEventClickOptions {}
export interface UserEventDoubleClickOptions {}
export interface UserEventTripleClickOptions {}
export interface UserEventDragAndDropOptions {}

export interface UserEventTabOptions {
  shift?: boolean
}

export interface UserEventTypeOptions {
  skipClick?: boolean
  skipAutoClose?: boolean
}

type Platform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'

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
   * @see {@link https://vitest.dev/guide/browser/commands}
   */
  commands: BrowserCommands
}

/**
 * Handler for user interactions. The support is provided by the browser provider (`playwright` or `webdriverio`).
 * If used with `preview` provider, fallbacks to simulated events via `@testing-library/user-event`.
 * @experimental
 */
export const userEvent: UserEvent

/**
 * Available commands for the browser.
 * A shortcut to `server.commands`.
 * @see {@link https://vitest.dev/guide/browser/commands}
 */
export const commands: BrowserCommands

export interface BrowserPage {
  /**
   * Serialized test config.
   */
  config: SerializedConfig
  /**
   * Change the size of iframe's viewport.
   */
  viewport(width: number, height: number): Promise<void>
  /**
   * Make a screenshot of the test iframe or a specific element.
   * @returns Path to the screenshot file or path and base64.
   */
  screenshot(options: Omit<ScreenshotOptions, 'base64'> & { base64: true }): Promise<{
    path: string
    base64: string
  }>
  screenshot(options?: ScreenshotOptions): Promise<string>
}

export const page: BrowserPage
export const cdp: () => CDPSession
