export {
  startCoverageInsideWorker,
  stopCoverageInsideWorker,
  takeCoverageInsideWorker,
} from '../integrations/coverage'
export {
  loadDiffConfig,
  loadSnapshotSerializers,
  setupCommonEnv,
} from '../runtime/setup-common'
export { type OTELCarrier, Traces } from '../utils/traces'
export { collectTests, startTests } from '@vitest/runner'
export * as SpyModule from '@vitest/spy'
export type { LoupeOptions, ParsedStack, StringifyOptions } from '@vitest/utils'
export {
  browserFormat,
  format,
  inspect,
  stringify,
} from '@vitest/utils/display'
export { processError } from '@vitest/utils/error'
export { getType } from '@vitest/utils/helpers'
export {
  DecodedMap,
  getOriginalPosition,
} from '@vitest/utils/source-map'
export { getSafeTimers, setSafeTimers } from '@vitest/utils/timers'

export interface FsOptions {
  encoding?: BufferEncoding
  flag?: string | number
}

export interface BrowserCommands {
  readFile: (
    path: string,
    options?: BufferEncoding | FsOptions,
  ) => Promise<string>
  writeFile: (
    path: string,
    content: string,
    options?: BufferEncoding | (FsOptions & { mode?: number | string }),
  ) => Promise<void>
  removeFile: (path: string) => Promise<void>
}
/**
 * @internal
 */
export const __INTERNAL: {
  _asLocator: (lang: 'javascript', selector: string) => string
  _createLocator: (selector: string) => any
  _extendedMethods: Set<string>
} = {
  _extendedMethods: new Set(),
} as any
