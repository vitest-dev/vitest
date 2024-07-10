import type { UserEventClickOptions, UserEventFillOptions } from '@vitest/browser/context'
import type { BrowserRPC } from '@vitest/browser/client'
import { getBrowserState, getWorkerState } from '../../utils'

export class Locator {
  path: string

  constructor(path: string) {
    this.path = path
  }

  click(options: UserEventClickOptions = {}) {
    return this.triggerCommand('__vitest_click', this.path, options)
  }

  dblClick(options: UserEventClickOptions = {}) {
    return this.triggerCommand('__vitest_dblClick', this.path, options)
  }

  tripleClick(options: UserEventClickOptions = {}) {
    return this.triggerCommand('__vitest_tripleClick', this.path, options)
  }

  clear() {
    return this.triggerCommand('__vitest_clear', this.path)
  }

  hover() {
    return this.triggerCommand('__vitest_hover', this.path)
  }

  fill(text: string, options?: UserEventFillOptions) {
    return this.triggerCommand('__vitest_fill', this.path, text, options)
  }

  // dropTo(target: Element, options = {}) {
  //   const targetCss = convertElementToCssSelector(target)
  //   return this.triggerCommand('__vitest_dragAndDrop', this.path, targetCss, options)
  // }

  // unhover() {
  //   return triggerCommand('__vitest_hover', css)
  // }

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
    const filepath = this.worker.filepath || this.worker.current?.file?.filepath || undefined
    return this.rpc.triggerCommand<T>(this.state.contextId, command, filepath, args)
  }
}
