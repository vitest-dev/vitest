import { isCI } from 'std-env'

const isNode: boolean
  = typeof process < 'u'
    && typeof process.stdout < 'u'
    && !process.versions?.deno
    && !globalThis.window
const isDeno: boolean
  = typeof process < 'u'
    && typeof process.stdout < 'u'
    && process.versions?.deno !== undefined
export const isWindows: boolean = (isNode || isDeno) && process.platform === 'win32'
export const isTTY: boolean = ((isNode || isDeno) && process.stdout?.isTTY && !isCI)
export const isForceColor = (): boolean => 'FORCE_COLOR' in process.env
export { isAgent, isCI, provider as stdProvider } from 'std-env'
