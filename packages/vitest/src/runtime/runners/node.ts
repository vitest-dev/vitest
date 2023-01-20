import process from 'node:process'
import type { File, Suite, TaskResult, Test, TestContext, VitestRunner } from '@vitest/runner'
import { GLOBAL_EXPECT, getState, setState } from '@vitest/expect'
import { rpc } from '../rpc'
import { getSnapshotClient } from '../../integrations/snapshot/chai'
import { vi } from '../../integrations/vi'
import { takeCoverageInsideWorker } from '../../integrations/coverage'
import { getFullName, getWorkerState } from '../../utils'
import { createExpect } from '../../integrations/chai/index'
import type { ResolvedConfig } from '#types'

export class NodeTestRunner implements VitestRunner {
  private snapshotClient = getSnapshotClient()
  private workerState = getWorkerState()

  constructor(public config: ResolvedConfig) {}

  importFile(filepath: string): unknown {
    return import(filepath)
  }

  onCollected(files: File[]) {
    rpc().onCollected(files)
  }

  onBeforeRun() {
    this.snapshotClient.clear()
  }

  async onAfterRun() {
    const coverage = await takeCoverageInsideWorker(this.config.coverage)
    rpc().onAfterSuiteRun({ coverage })
    this.snapshotClient.saveCurrent()
  }

  onAfterRunSuite(suite: Suite) {
    if (this.config.logHeapUsage)
      suite.result!.heap = process.memoryUsage().heapUsed
  }

  onAfterRunTest(test: Test) {
    this.snapshotClient.clearTest()

    if (this.config.logHeapUsage)
      test.result!.heap = process.memoryUsage().heapUsed

    this.workerState.current = undefined
  }

  async onBeforeRunTest(test: Test) {
    if (test.mode !== 'run') {
      this.snapshotClient.skipTestSnapshots(test)
      return
    }

    clearModuleMocks(this.config)
    await this.snapshotClient.setTest(test)

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

  augmentTestContext(context: TestContext): TestContext {
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

  onTaskUpdate(task: [string, TaskResult | undefined][]): Promise<void> {
    return rpc().onTaskUpdate(task)
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
