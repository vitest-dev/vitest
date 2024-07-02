export const isNode: boolean
  = typeof process < 'u'
  && typeof process.stdout < 'u'
  && !process.versions?.deno
  && !globalThis.window
export const isDeno: boolean
  = typeof process < 'u'
  && typeof process.stdout < 'u'
  && process.versions?.deno !== undefined
export const isWindows = (isNode || isDeno) && process.platform === 'win32'
export const isBrowser: boolean = typeof window !== 'undefined'
export { isCI, provider as stdProvider } from 'std-env'
