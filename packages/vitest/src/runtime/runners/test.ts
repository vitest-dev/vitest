import type { CancelReason, Custom, ExtendedContext, Suite, TaskContext, Test, VitestRunner, VitestRunnerImportSource } from '@vitest/runner'
import type { ExpectStatic } from '@vitest/expect'
import { GLOBAL_EXPECT, getState, setState } from '@vitest/expect'
import { getSnapshotClient } from '../../integrations/snapshot/chai'
import { vi } from '../../integrations/vi'
import { getFullName, getNames, getTests, getWorkerState } from '../../utils'
import { createExpect } from '../../integrations/chai/index'
import type { ResolvedConfig } from '../../types/config'
import type { VitestExecutor } from '../execute'
import { rpc } from '../rpc'

export class VitestTestRunner implements VitestRunner {
  private snapshotClient = getSnapshotClient()
  private workerState = getWorkerState()
  private __vitest_executor!: VitestExecutor
  private cancelRun = false

  constructor(public config: ResolvedConfig) {}

  importFile(filepath: string, source: VitestRunnerImportSource): unknown {
    if (source === 'setup')
      this.workerState.moduleCache.delete(filepath)
    return this.__vitest_executor.executeId(filepath)
  }

  onBeforeRunFiles() {
    this.snapshotClient.clear()
  }

  async onAfterRunSuite(suite: Suite) {
    if (this.config.logHeapUsage && typeof process !== 'undefined')
      suite.result!.heap = process.memoryUsage().heapUsed

    if (suite.mode !== 'skip' && typeof suite.filepath !== 'undefined') {
      // mark snapshots in skipped tests as not obsolete
      for (const test of getTests(suite)) {
        if (test.mode === 'skip') {
          const name = getNames(test).slice(1).join(' > ')
          this.snapshotClient.skipTestSnapshots(name)
        }
      }

      const result = await this.snapshotClient.finishCurrentRun()
      if (result)
        await rpc().snapshotSaved(result)
    }
  }

  onAfterRunTask(test: Test) {
    this.snapshotClient.clearTest()

    if (this.config.logHeapUsage && typeof process !== 'undefined')
      test.result!.heap = process.memoryUsage().heapUsed

    this.workerState.current = undefined
  }

  onCancel(_reason: CancelReason) {
    this.cancelRun = true
  }

  async onBeforeRunTask(test: Test) {
    if (this.cancelRun)
      test.mode = 'skip'

    if (test.mode !== 'run')
      return

    clearModuleMocks(this.config)

    this.workerState.current = test
  }

  async onBeforeRunSuite(suite: Suite) {
    if (this.cancelRun)
      suite.mode = 'skip'

    // initialize snapshot state before running file suite
    if (suite.mode !== 'skip' && typeof suite.filepath !== 'undefined') {
      // default "name" is irrelevant for Vitest since each snapshot assertion
      // (e.g. `toMatchSnapshot`) specifies "filepath" / "name" pair explicitly
      await this.snapshotClient.startCurrentRun(suite.filepath, '__default_name_', this.workerState.config.snapshotOptions)
    }
  }

  onBeforeTryTask(test: Test) {
    setState({
      assertionCalls: 0,
      isExpectingAssertions: false,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null,
      testPath: test.suite.file?.filepath,
      currentTestName: getFullName(test),
      snapshotState: this.snapshotClient.snapshotState,
    }, (globalThis as any)[GLOBAL_EXPECT])
  }

  onAfterTryTask(test: Test) {
    const {
      assertionCalls,
      expectedAssertionsNumber,
      expectedAssertionsNumberErrorGen,
      isExpectingAssertions,
      isExpectingAssertionsError,
      // @ts-expect-error local is untyped
    } = test.context._local
      ? test.context.expect.getState()
      : getState((globalThis as any)[GLOBAL_EXPECT])
    if (expectedAssertionsNumber !== null && assertionCalls !== expectedAssertionsNumber)
      throw expectedAssertionsNumberErrorGen!()
    if (isExpectingAssertions === true && assertionCalls === 0)
      throw isExpectingAssertionsError
  }

  extendTaskContext<T extends Test | Custom>(context: TaskContext<T>): ExtendedContext<T> {
    let _expect: ExpectStatic | undefined
    Object.defineProperty(context, 'expect', {
      get() {
        if (!_expect)
          _expect = createExpect(context.task)
        return _expect
      },
    })
    Object.defineProperty(context, '_local', {
      get() {
        return _expect != null
      },
    })
    return context as ExtendedContext<T>
  }
}

function clearModuleMocks(config: ResolvedConfig) {
  const { clearMocks, mockReset, restoreMocks, unstubEnvs, unstubGlobals } = config

  // since each function calls another, we can just call one
  if (restoreMocks)
    vi.restoreAllMocks()
  else if (mockReset)
    vi.resetAllMocks()
  else if (clearMocks)
    vi.clearAllMocks()

  if (unstubEnvs)
    vi.unstubAllEnvs()
  if (unstubGlobals)
    vi.unstubAllGlobals()
}
