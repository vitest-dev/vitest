import type {
  LocatorScreenshotOptions,
  UserEventClickOptions,
  UserEventDragAndDropOptions,
  UserEventFillOptions,
} from '@vitest/browser/context'
import { page } from '@vitest/browser/context'
import type { BrowserRPC } from '@vitest/browser/client'
import { getBrowserState, getWorkerState } from '../../utils'

export abstract class Locator {
  selector: string

  constructor(selector: string) {
    this.selector = selector
  }

  click(options: UserEventClickOptions = {}) {
    return this.triggerCommand<void>('__vitest_click', this.selector, options)
  }

  dblClick(options: UserEventClickOptions = {}) {
    return this.triggerCommand<void>('__vitest_dblClick', this.selector, options)
  }

  tripleClick(options: UserEventClickOptions = {}) {
    return this.triggerCommand<void>('__vitest_tripleClick', this.selector, options)
  }

  clear() {
    return this.triggerCommand<void>('__vitest_clear', this.selector)
  }

  hover() {
    return this.triggerCommand<void>('__vitest_hover', this.selector)
  }

  unhover() {
    return this.triggerCommand<void>('__vitest_hover', 'html > body')
  }

  fill(text: string, options?: UserEventFillOptions) {
    return this.triggerCommand<void>('__vitest_fill', this.selector, text, options)
  }

  dropTo(target: Locator, options: UserEventDragAndDropOptions = {}) {
    return this.triggerCommand<void>(
      '__vitest_dragAndDrop',
      this.selector,
      target.selector,
      options,
    )
  }

  screenshot(options: Omit<LocatorScreenshotOptions, 'base64'> & { base64: true }): Promise<{
    path: string
    base64: string
  }>
  screenshot(options?: LocatorScreenshotOptions): Promise<string>
  screenshot(options?: LocatorScreenshotOptions): Promise<string | {
    path: string
    base64: string
  }> {
    return page.screenshot({
      ...options,
      element: this,
    })
  }

  // TODO: support options
  abstract getByRole(role: string): Locator
  abstract getByLabelText(text: string | RegExp): Locator
  abstract getByAltText(text: string | RegExp): Locator
  abstract getByTestId(testId: string | RegExp): Locator
  abstract getByPlaceholder(text: string | RegExp): Locator
  abstract getByText(text: string | RegExp): Locator
  abstract getByTitle(title: string | RegExp): Locator

  abstract element(): Element | undefined

  protected get state() {
    return getBrowserState()
  }

  protected get worker() {
    return getWorkerState()
  }

  private get rpc() {
    return this.worker.rpc as any as BrowserRPC
  }

  protected triggerCommand<T>(command: string, ...args: any[]) {
    const filepath = this.worker.filepath
      || this.worker.current?.file?.filepath
      || undefined

    return this.rpc.triggerCommand<T>(
      this.state.contextId,
      command,
      filepath,
      args,
    )
  }
}
