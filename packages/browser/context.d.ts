import type { SerializedConfig } from 'vitest'
import { ARIARole } from './aria-role.js'

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
  element?: Element | Locator
  /**
   * Path relative to the current test file.
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
   * Cleans up the user event instance, releasing any resources or state it holds,
   * such as keyboard press state. For the default `userEvent` instance, this method
   * is automatically called after each test case.
   */
  cleanup: () => Promise<void>
  /**
   * Click on an element. Uses provider's API under the hood and supports all its options.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-click} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/click/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#click} testing-library API
   */
  click: (element: Element | Locator, options?: UserEventClickOptions) => Promise<void>
  /**
   * Triggers a double click event on an element. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-dblclick} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/doubleClick/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#dblClick} testing-library API
   */
  dblClick: (element: Element | Locator, options?: UserEventDoubleClickOptions) => Promise<void>
  /**
   * Triggers a triple click event on an element. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-click} Playwright API: using `click` with `clickCount: 3`
   * @see {@link https://webdriver.io/docs/api/browser/actions/} WebdriverIO API: using actions api with `move` plus three `down + up + pause` events in a row
   * @see {@link https://testing-library.com/docs/user-event/convenience/#tripleclick} testing-library API
   */
  tripleClick: (element: Element | Locator, options?: UserEventTripleClickOptions) => Promise<void>
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
    values: HTMLElement | HTMLElement[] | Locator | Locator[] | string | string[],
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
   * This method can be significantly slower than `userEvent.fill`, so it should be used only when necessary.
   * @example
   * await userEvent.type(input, 'foo') // translates to: f, o, o
   * await userEvent.type(input, '{{a[[') // translates to: {, a, [
   * await userEvent.type(input, '{Shift}{f}{o}{o}') // translates to: Shift, f, o, o
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-press} Playwright API
   * @see {@link https://webdriver.io/docs/api/browser/action#key-input-source} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/utility/#type} testing-library API
   */
  type: (element: Element | Locator, text: string, options?: UserEventTypeOptions) => Promise<void>
  /**
   * Removes all text from an element. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-clear} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/clearValue} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/utility/#clear} testing-library API
   */
  clear: (element: Element | Locator) => Promise<void>
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
  hover: (element: Element | Locator, options?: UserEventHoverOptions) => Promise<void>
  /**
   * Moves cursor position to the body element. Uses provider's API under the hood.
   * By default, the cursor position is in the center (in webdriverio) or in some visible place (in playwright)
   * of the body element, so if the current element is already there, this will have no effect.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-hover} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/moveTo/} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/convenience/#hover} testing-library API
   */
  unhover: (element: Element | Locator, options?: UserEventHoverOptions) => Promise<void>
  /**
   * Change a file input element to have the specified files. Uses provider's API under the hood.
   * @see {@link https://playwright.dev/docs/api/class-locator#locator-set-input-files} Playwright API
   * @see {@link https://testing-library.com/docs/user-event/utility#upload} testing-library API
   */
  upload: (element: Element | Locator, files: File | File[] | string | string[]) => Promise<void>
  /**
   * Copies the selected content.
   * @see {@link https://playwright.dev/docs/api/class-keyboard} Playwright API
   * @see {@link https://webdriver.io/docs/api/browser/keys//} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/clipboard#copy} testing-library API
   */
  copy: () => Promise<void>
  /**
   * Cuts the selected content.
   * @see {@link https://playwright.dev/docs/api/class-keyboard} Playwright API
   * @see {@link https://webdriver.io/docs/api/browser/keys//} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/clipboard#cut} testing-library API
   */
  cut: () => Promise<void>
  /**
   * Pastes the copied or cut content.
   * @see {@link https://playwright.dev/docs/api/class-keyboard} Playwright API
   * @see {@link https://webdriver.io/docs/api/browser/keys//} WebdriverIO API
   * @see {@link https://testing-library.com/docs/user-event/clipboard#paste} testing-library API
   */
  paste: () => Promise<void>
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
  fill: (element: Element | Locator, text: string, options?: UserEventFillOptions) => Promise<void>
  /**
   * Drags a source element on top of the target element. This API is not supported by "preview" provider.
   * @see {@link https://playwright.dev/docs/api/class-frame#frame-drag-and-drop} Playwright API
   * @see {@link https://webdriver.io/docs/api/element/dragAndDrop/} WebdriverIO API
   */
  dragAndDrop: (source: Element | Locator, target: Element | Locator, options?: UserEventDragAndDropOptions) => Promise<void>
}

export interface UserEventFillOptions {}
export interface UserEventHoverOptions {}
export interface UserEventSelectOptions {}
export interface UserEventClickOptions {}
export interface UserEventDoubleClickOptions {}
export interface UserEventTripleClickOptions {}
export interface UserEventDragAndDropOptions {}

export interface LocatorOptions {
  /**
   * Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a
   * regular expression. Note that exact match still trims whitespace.
   */
  exact?: boolean
}

export interface LocatorByRoleOptions extends LocatorOptions {
  /**
   * Should checked elements (set by `aria-checked` or `<input type="checkbox"/>`) be included or not. By default, the filter is not applied.
   *
   * See [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked) for more information
   */
  checked?: boolean
  /**
   * Should disabled elements be included or not. By default, the filter is not applied. Note that unlike other attributes, `disable` state is inherited.
   *
   * See [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled) for more information
   */
  disabled?: boolean
  /**
   * Should expanded elements be included or not. By default, the filter is not applied.
   *
   * See [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded) for more information
   */
  expanded?: boolean
  /**
   * Should elements that are [normally excluded](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion) from the accessibility tree be queried. By default, only non-hidden elements are matched by role selector.
   *
   * Note that roles `none` and `presentation` are always included.
   * @default false
   */
  includeHidden?: boolean
  /**
   * A number attribute that is usually present for `heading`, `listitem`, `row`, `treeitem` roles with default values for `<h1>-<h6>` elements. By default, the filter is not applied.
   *
   * See [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level) for more information
   */
  level?: number
  /**
   * Option to match the [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). By default, matching is
   * case-insensitive and searches for a substring, use `exact` to control this behavior.
   */
  name?: string | RegExp
  /**
   * Should pressed elements be included or not. By default, the filter is not applied.
   *
   * See [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed) for more information
   */
  pressed?: boolean
  /**
   * Should selected elements be included or not. By default, the filter is not applied.
   *
   * See [`aria-selected`](https://www.w3.org/TR/wai-aria-1.2/#aria-selected) for more information
   */
  selected?: boolean
}

interface LocatorScreenshotOptions extends Omit<ScreenshotOptions, 'element'> {}

interface LocatorSelectors {
  /**
   * Creates a way to locate an element by its [ARIA role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles), [ARIA attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes) and [accessible name](https://developer.mozilla.org/en-US/docs/Glossary/Accessible_name).
   * @see {@link https://vitest.dev/guide/browser/locators#getbyrole}
   */
  getByRole(role: ARIARole | ({} & string), options?: LocatorByRoleOptions): Locator
  /**
   * @see {@link https://vitest.dev/guide/browser/locators#getbylabeltext}
   */
  getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator
  /**
   * Creates a locator capable of finding an element with an `alt` attribute that matches the text. Unlike testing-library's implementation, Vitest will match any element that has an `alt` attribute.
   * @see {@link https://vitest.dev/guide/browser/locators#getbyalttext}
   */
  getByAltText(text: string | RegExp, options?: LocatorOptions): Locator
  /**
   * Creates a locator capable of finding an element that has the specified placeholder text. Vitest will match any element that has a matching `placeholder` attribute, not just `input`.
   * @see {@link https://vitest.dev/guide/browser/locators#getbyplaceholder}
   */
  getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator
  /**
   * Creates a locator capable of finding an element that contains the specified text. The text will be matched against TextNode's [`nodeValue`](https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeValue) or input's value if the type is `button` or `reset`.
   * Matching by text always normalizes whitespace, even with exact match.
   * For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.
   * @see {@link https://vitest.dev/guide/browser/locators#getbytext}
   */
  getByText(text: string | RegExp, options?: LocatorOptions): Locator
  /**
   * Creates a locator capable of finding an element that has the specified `title` attribute. Unlike testing-library's `getByTitle`, Vitest cannot find `title` elements within an SVG.
   * @see {@link https://vitest.dev/guide/browser/locators#getbytitle}
   */
  getByTitle(text: string | RegExp, options?: LocatorOptions): Locator
  /**
   * Creates a locator capable of finding an element that matches the specified test id attribute. You can configure the attribute name with [`browser.locators.testIdAttribute`](/config/#browser-locators-testidattribute).
   * @see {@link https://vitest.dev/guide/browser/locators#getbytestid}
   */
  getByTestId(text: string | RegExp): Locator
}

export interface Locator extends LocatorSelectors {
  /**
   * Selector string that will be used to locate the element by the browser provider.
   * You can use this string in the commands API:
   * ```ts
   * // playwright
   * function test({ selector, iframe }) {
   *   await iframe.locator(selector).click()
   * }
   * // webdriverio
   * function test({ selector, browser }) {
   *   await browser.$(selector).click()
   * }
   * ```
   * @see {@link https://vitest.dev/guide/browser/locators#selector}
   */
  readonly selector: string

  /**
   * Click on an element. You can use the options to set the cursor position.
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-click}
   */
  click(options?: UserEventClickOptions): Promise<void>
  /**
   * Triggers a double click event on an element. You can use the options to set the cursor position.
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-dblclick}
   */
  dblClick(options?: UserEventDoubleClickOptions): Promise<void>
  /**
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-tripleclick}
   */
  tripleClick(options?: UserEventTripleClickOptions): Promise<void>
  /**
   * Clears the input element content
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-clear}
   */
  clear(): Promise<void>
  /**
   * Moves the cursor position to the selected element
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-hover}
   */
  hover(options?: UserEventHoverOptions): Promise<void>
  /**
   * This works the same as `locator.hover`, but moves the cursor to the `document.body` element instead.
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-unhover}
   */
  unhover(options?: UserEventHoverOptions): Promise<void>
  /**
   * Sets the value of the current `input`, `textarea` or `conteneditable` element.
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-fill}
   */
  fill(text: string, options?: UserEventFillOptions): Promise<void>
  /**
   * Drags the current element to the target location.
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-dropto}
   */
  dropTo(target: Locator, options?: UserEventDragAndDropOptions): Promise<void>
  /**
   * Choose one or more values from a `<select>` element.
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-selectoptions}
   */
  selectOptions(
    values: HTMLElement | HTMLElement[] | Locator | Locator[] | string | string[],
    options?: UserEventSelectOptions,
  ): Promise<void>
  /**
   * Change a file input element to have the specified files. Uses provider's API under the hood.
   * @see {@link https://vitest.dev/guide/browser/interactivity-api#userevent-upload}
   */
  upload: (files: File | File[] | string | string[]) => Promise<void>

  /**
   * Make a screenshot of an element matching the locator.
   * @see {@link https://vitest.dev/guide/browser/locators#screenshot}
   */
  screenshot(options: Omit<LocatorScreenshotOptions, 'base64'> & { base64: true }): Promise<{
    path: string
    base64: string
  }>
  screenshot(options?: LocatorScreenshotOptions): Promise<string>

  /**
   * Returns an element matching the selector.
   *
   * - If multiple elements match the selector, an error is thrown.
   * - If no elements match the selector, an error is thrown.
   *
   * @see {@link https://vitest.dev/guide/browser/locators#element}
   */
  element(): Element
  /**
   * Returns an array of elements matching the selector.
   *
   * If no elements match the selector, an empty array is returned.
   *
   * @see {@link https://vitest.dev/guide/browser/locators#elements}
   */
  elements(): Element[]
  /**
   * Returns an element matching the selector.
   *
   * - If multiple elements match the selector, an error is thrown.
   * - If no elements match the selector, returns `null`.
   *
   * @see {@link https://vitest.dev/guide/browser/locators#query}
   */
  query(): Element | null
  /**
   * Wraps an array of `.elements()` matching the selector in a new `Locator`.
   *
   * @see {@link https://vitest.dev/guide/browser/locators#all}
   */
  all(): Locator[]
  /**
   * Returns a locator for the nth element matching the selector.
   * @see {@link https://vitest.dev/guide/browser/locators#nth}
   */
  nth(index: number): Locator
  /**
   * Returns a locator for the first element matching the selector.
   * @see {@link https://vitest.dev/guide/browser/locators#first}
   */
  first(): Locator
  /**
   * Returns a locator for the last element matching the selector.
   * @see {@link https://vitest.dev/guide/browser/locators#last}
   */
  last(): Locator
}

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
  /**
   * Serialized test config.
   */
  config: SerializedConfig
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

export interface BrowserPage extends LocatorSelectors {
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
  /**
   * Extend default `page` object with custom methods.
   */
  extend(methods: Partial<BrowserPage>): BrowserPage
  /**
   * Wrap an HTML element in a `Locator`. When querying for elements, the search will always return this element.
   * @see {@link https://vitest.dev/guide/browser/locators}
   */
  elementLocator(element: Element): Locator
}

export const page: BrowserPage
export const cdp: () => CDPSession
