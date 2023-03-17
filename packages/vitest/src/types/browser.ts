export interface BrowserProvider {
  browser?: string | boolean
  headless: boolean

  is(_browserName: string): boolean
  start(url: string): Promise<void>
}
