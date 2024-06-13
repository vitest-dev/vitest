import type { ResolvedConfig } from 'vitest'

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

export interface TypePayload {
  type: string
}
export interface PressPayload {
  press: string
}
export interface DownPayload {
  down: string
}
export interface UpPayload {
  up: string
}

export type SendKeysPayload =
  | TypePayload
  | PressPayload
  | DownPayload
  | UpPayload

export interface ScreenshotOptions {
  element?: Element
  /**
   * Path relative to the `screenshotDirectory` in the test config.
   */
  path?: string
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
  sendKeys: (payload: SendKeysPayload) => Promise<void>
}

export interface UserEvent {
  /**
   * Click on an element. Uses provider's API under the hood and supports all its options.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-click} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/click/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#click} testing-library API
   */
  click: (element: Element, options?: UserEventClickOptions) => Promise<void>
  /**
   * Type text on the keyboard. If any input is focused, it will receive the text,
   * otherwise it will be typed on the document. Uses provider's API under the hood.
   * **Supports** [user-event `keyboard` syntax](https://testing-library.com/docs/user-event/keyboard) (e.g., `{Shift}`) even with `playwright` and `webdriverio` providers.
   * @example
   * await userEvent.keyboard('foo') // translates to: f, o, o
   * await userEvent.keyboard('{{a[[') // translates to: {, a, [
   * await userEvent.keyboard('{Shift}{f}{o}{o}') // translates to: Shift, f, o, o
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-press} Playwright API
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
   * @see {@link https://webdriver.io/docs/api/browser/keys} WebdriverIO API
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
  fill: (element: Element, text: string) => Promise<void>
}

export interface UserEventClickOptions {
  [key: string]: any
}

export interface UserEventTabOptions {
  shift?: boolean
  [key: string]: any
}

export interface UserEventTypeOptions {
  skipClick?: boolean
  skipAutoClose?: boolean
  [key: string]: any
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
   * @see {@link https://vitest.dev/guide/browser#commands}
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
 * @see {@link https://vitest.dev/guide/browser#commands}
 */
export const commands: BrowserCommands

export interface BrowserPage {
  /**
   * Serialized test config.
   */
  config: ResolvedConfig
  /**
   * Change the size of iframe's viewport.
   */
  viewport: (width: number, height: number) => Promise<void>
  /**
   * Make a screenshot of the test iframe or a specific element.
   * @returns Path to the screenshot file.
   */
  screenshot: (options?: ScreenshotOptions) => Promise<string>
}

export const page: BrowserPage
