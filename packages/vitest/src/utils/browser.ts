export class BaseBrowserProvider {
  browser?: string | boolean

  is(_browserName: string) {
    return this.browser === _browserName
  }

  /**
  * if browser === true then the user will handle joining the link in the target
  * browser, otherwise, we should handle starting our own browser using webdriverio
  */
  shouldStart() {
    return typeof this.browser === 'string'
  }
}
