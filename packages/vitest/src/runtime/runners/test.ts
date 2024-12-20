import type { ExpectStatic } from '@vitest/expect'
import type {
  CancelReason,
  File,
  Suite,
  Task,
  TestContext,
  VitestRunner,
  VitestRunnerImportSource,
} from '@vitest/runner'
import type { SerializedConfig } from '../config'
import type { VitestExecutor } from '../execute'
import { getState, GLOBAL_EXPECT, setState } from '@vitest/expect'
import { getNames, getTestName, getTests } from '@vitest/runner/utils'
import { createExpect } from '../../integrations/chai/index'
import { inject } from '../../integrations/inject'
import { getSnapshotClient } from '../../integrations/snapshot/chai'
import { vi } from '../../integrations/vi'
import { rpc } from '../rpc'
import { getWorkerState } from '../utils'

export class VitestTestRunner implements VitestRunner {
  private snapshotClient = getSnapshotClient()
  private workerState = getWorkerState()
  private __vitest_executor!: VitestExecutor
  private cancelRun = false

  private assertionsErrors = new WeakMap<Readonly<Task>, Error>()

  public pool = this.workerState.ctx.pool

  constructor(public config: SerializedConfig) {}

  async importFile(filepath: string, source: VitestRunnerImportSource): Promise<unknown> {
    if (source === 'setup') {
      const resolved = await this.__vitest_executor.resolveUrl(filepath)
      this.workerState.moduleCache.delete(resolved[1])
    }
    return this.__vitest_executor.executeId(filepath)
  }

  onCollectStart(file: File) {
    this.workerState.current = file
  }

  onAfterRunFiles() {
    this.snapshotClient.clear()
    this.workerState.current = undefined
  }

  async onAfterRunSuite(suite: Suite) {
    if (this.config.logHeapUsage && typeof process !== 'undefined') {
      suite.result!.heap = process.memoryUsage().heapUsed
    }

    if (suite.mode !== 'skip' && 'filepath' in suite) {
      // mark snapshots in skipped tests as not obsolete
      for (const test of getTests(suite)) {
        if (test.mode === 'skip') {
          const name = getNames(test).slice(1).join(' > ')
          this.snapshotClient.skipTest(suite.file.filepath, name)
        }
      }

      const result = await this.snapshotClient.finish(suite.file.filepath)
      await rpc().snapshotSaved(result)
    }

    this.workerState.current = suite.suite || suite.file
  }

  onAfterRunTask(test: Task) {
    if (this.config.logHeapUsage && typeof process !== 'undefined') {
      test.result!.heap = process.memoryUsage().heapUsed
    }

    this.workerState.current = test.suite || test.file
  }

  onCancel(_reason: CancelReason) {
    this.cancelRun = true
  }

  injectValue(key: string) {
    // inject has a very limiting type controlled by ProvidedContext
    // some tests override it which causes the build to fail
    return (inject as any)(key)
  }

  async onBeforeRunTask(test: Task) {
    if (this.cancelRun) {
      test.mode = 'skip'
    }

    if (test.mode !== 'run' && test.mode !== 'queued') {
      return
    }

    clearModuleMocks(this.config)

    this.workerState.current = test
  }

  async onBeforeRunSuite(suite: Suite) {
    if (this.cancelRun) {
      suite.mode = 'skip'
    }

    // initialize snapshot state before running file suite
    if (suite.mode !== 'skip' && 'filepath' in suite) {
      await this.snapshotClient.setup(
        suite.file.filepath,
        this.workerState.config.snapshotOptions,
      )
    }

    this.workerState.current = suite
  }

  onBeforeTryTask(test: Task) {
    this.snapshotClient.clearTest(test.file.filepath, test.id)
    setState(
      {
        assertionCalls: 0,
        isExpectingAssertions: false,
        isExpectingAssertionsError: null,
        expectedAssertionsNumber: null,
        expectedAssertionsNumberErrorGen: null,
        testPath: test.file.filepath,
        currentTestName: getTestName(test),
        snapshotState: this.snapshotClient.getSnapshotState(test.file.filepath),
      },
      (globalThis as any)[GLOBAL_EXPECT],
    )
  }

  onAfterTryTask(test: Task) {
    const {
      assertionCalls,
      expectedAssertionsNumber,
      expectedAssertionsNumberErrorGen,
      isExpectingAssertions,
      isExpectingAssertionsError,
    }
      // @ts-expect-error _local is untyped
      = 'context' in test && test.context._local
        ? test.context.expect.getState()
        : getState((globalThis as any)[GLOBAL_EXPECT])
    if (
      expectedAssertionsNumber !== null
      && assertionCalls !== expectedAssertionsNumber
    ) {
      throw expectedAssertionsNumberErrorGen!()
    }
    if (isExpectingAssertions === true && assertionCalls === 0) {
      throw isExpectingAssertionsError
    }
    if (this.config.expect.requireAssertions && assertionCalls === 0) {
      throw this.assertionsErrors.get(test)
    }
  }

  extendTaskContext(context: TestContext): TestContext {
    // create error during the test initialization so we have a nice stack trace
    if (this.config.expect.requireAssertions) {
      this.assertionsErrors.set(
        context.task,
        new Error('expected any number of assertion, but got none'),
      )
    }
    let _expect: ExpectStatic | undefined
    Object.defineProperty(context, 'expect', {
      get() {
        if (!_expect) {
          _expect = createExpect(context.task)
        }
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

function clearModuleMocks(config: SerializedConfig) {
  const { clearMocks, mockReset, restoreMocks, unstubEnvs, unstubGlobals }
    = config

  // since each function calls another, we can just call one
  if (restoreMocks) {
    vi.restoreAllMocks()
  }
  else if (mockReset) {
    vi.resetAllMocks()
  }
  else if (clearMocks) {
    vi.clearAllMocks()
  }

  if (unstubEnvs) {
    vi.unstubAllEnvs()
  }
  if (unstubGlobals) {
    vi.unstubAllGlobals()
  }
}
