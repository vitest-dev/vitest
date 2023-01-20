import type { File, SequenceHooks, Suite, TaskResult, Test, TestContext } from './tasks'

export interface VitestRunnerConfig {
  root: string
  setupFiles: string[] | string
  name: string
  passWithNoTests: boolean
  testNamePattern?: string
  allowOnly?: boolean
  sequence: {
    shuffle: boolean
    seed: number
    hooks: SequenceHooks
  }
  maxConcurrency: number
  testTimeout: number
  hookTimeout: number
}

export interface VitestRunner {
  onBeforeCollect?(): unknown
  onCollected?(files: File[]): unknown

  onBeforeRunTest?(test: Test): unknown
  onBeforeTryTest?(test: Test, retryCount: number): unknown
  onAfterRunTest?(test: Test): unknown
  onAfterTryTest?(test: Test, retryCount: number): unknown

  onBeforeRunSuite?(suite: Suite): unknown
  onAfterRunSuite?(suite: Suite): unknown

  onTaskUpdate?(task: [string, TaskResult | undefined][]): Promise<void>

  onAfterRun?(): unknown
  importFile(filepath: string): unknown
  augmentTestContext?(context: TestContext): TestContext
  config: VitestRunnerConfig
}
