import type { Suite, Test, TestContext, VitestRunner, VitestRunnerImportSource } from '@vitest/runner'
import { GLOBAL_EXPECT, getState, setState } from '@vitest/expect'
import { getSnapshotClient } from '../../integrations/snapshot/chai'
import { vi } from '../../integrations/vi'
import { getFullName, getWorkerState } from '../../utils'
import { createExpect } from '../../integrations/chai/index'
import type { ResolvedConfig } from '../../types/config'

export class VitestTestRunner implements VitestRunner {
  private snapshotClient = getSnapshotClient()
  private workerState = getWorkerState()

  constructor(public config: ResolvedConfig) {}

  importFile(filepath: string, source: VitestRunnerImportSource): unknown {
    if (source === 'setup')
      this.workerState.moduleCache.delete(filepath)
    return import(filepath)
  }

  onBeforeRun() {
    this.snapshotClient.clear()
  }

  async onAfterRun() {
    await this.snapshotClient.saveCurrent()
  }

  async onBeforeRunSuite(suite: Suite) {
    if (suite.mode !== 'run') {
      this.snapshotClient.skipSuiteSnapshots(suite)
      return
    }

    clearModuleMocks(this.config)
    await this.snapshotClient.setTaskBase({} as Test, suite)
  }

  onAfterRunSuite(suite: Suite) {
    if (suite.mode === 'skip')
      this.snapshotClient.skipSuiteSnapshots(suite)

    if (this.config.logHeapUsage && typeof process !== 'undefined')
      suite.result!.heap = process.memoryUsage().heapUsed
  }

  onAfterRunTest(test: Test) {
    this.snapshotClient.clearTest()

    if (this.config.logHeapUsage && typeof process !== 'undefined')
      test.result!.heap = process.memoryUsage().heapUsed

    this.workerState.current = undefined
  }

  async onBeforeRunTest(test: Test) {
    if (test.mode !== 'run') {
      this.snapshotClient.skipTestSnapshots(test)
      return
    }

    clearModuleMocks(this.config)
    await this.snapshotClient.setTaskBase(test)

    this.workerState.current = test
  }

  onBeforeTryTest(test: Test) {
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

  onAfterTryTest(test: Test) {
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

  extendTestContext(context: TestContext): TestContext {
    let _expect: Vi.ExpectStatic | undefined
    Object.defineProperty(context, 'expect', {
      get() {
        if (!_expect)
          _expect = createExpect(context.meta)
        return _expect
      },
    })
    Object.defineProperty(context, '_local', {
      get() {
        return _expect != null
      },
    })
    return context
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
