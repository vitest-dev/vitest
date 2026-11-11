import type { TestError } from '@vitest/utils'
import type { FetchResult } from 'vite/module-runner'

export type { ParsedStack, TestError } from '@vitest/utils'

export type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never

export interface AfterSuiteRunMeta {
  coverage?: unknown
  testFiles: string[]
  environment: string
  projectName?: string
}

export interface UserConsoleLog {
  content: string
  origin?: string
  browser?: boolean
  type: 'stdout' | 'stderr'
  taskId?: string
  time: number
  size: number
}

interface ModuleGraphModules {
  [id: string]: { external: boolean; imports: string[] }
}

export interface ModuleGraphData {
  modules: ModuleGraphModules
  roots: string[]
}

export interface SharedModuleGraphByProject {
  [projectName: string]: { [environmentName: string]: SharedModuleGraphData }
}

export interface SharedModuleGraphData {
  modules: ModuleGraphModules
  rootsByTestFile: { [testFile: string]: string[] }
}

export interface ProvidedContext {}

export interface ResolveFunctionResult {
  id: string
  file: string
  url: string
}

export type ModuleType = 'cjs' | 'esm'

export type VitestFetchResult = FetchResult & {
  moduleType?: ModuleType
  // the source map of `code` as a JSON string, `code` has no source map comment
  sourceMap?: string
}

export interface FetchCachedFileSystemResult {
  cached: true
  tmp: string
  id: string
  file: string | null
  url: string
  invalidate: boolean
  moduleType?: ModuleType
}

// These need to be compatible with Tinyrainbow's bg-colors, and CSS's background-color
export type LabelColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'

export interface AsyncLeak {
  filename: string
  projectName: string
  stack: string
  type: string
}

/**
 * A seed of a failed attempt that used `context.random` or `vi.useFakeRandom()`.
 * @experimental
 */
export interface FailedSeed {
  /** The seed, 16 hexadecimal digits. */
  seed: string
  /** The runs of the seed: the failed run, and its replay or retries. */
  runs: number
  /** The runs that failed with the same error as the first run. */
  reproduced: number
  /** A command that runs the test 1 time with this seed. */
  command: string
}

export interface SeedDetail {
  key: 'Failed' | 'Seed' | 'Seeds' | 'Reproduced' | 'Replay'
  value: string
  // a seed did not fail with the same error on every run
  warning?: boolean
}

export interface TestFailure {
  error: TestError
  details: SeedDetail[]
}

export interface TestFailureReport {
  // the errors of the test in the groups of the terminal
  failures: TestFailure[]
  failedSeeds: FailedSeed[]
}
