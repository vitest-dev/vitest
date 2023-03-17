export interface BrowserProvider {
  browser: string
  headless: boolean

  is(_browserName: string): boolean
  start(url: string): Promise<void>
}
