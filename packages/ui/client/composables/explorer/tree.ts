import type { File, TaskResultPack, TestAnnotation } from '@vitest/runner'
import type { RunnerTaskEventPack } from 'vitest'
import type {
  CollectorInfo,
  FilteredTests,
  RootTreeNode,
  UITaskTreeNode,
} from '~/composables/explorer/types'
import { config } from '~/composables/client'
import { useRafFn } from '@vueuse/core'
import { reactive } from 'vue'
import { runCollapseAllTask, runCollapseNode } from '~/composables/explorer/collapse'
import { annotateTest, collectTestsTotalData, preparePendingTasks, runCollect, runLoadFiles } from '~/composables/explorer/collector'
import { runExpandAll, runExpandNode } from '~/composables/explorer/expand'
import { runFilter } from '~/composables/explorer/filter'
import {
  filter,
  search,
} from '~/composables/explorer/state'

export class ExplorerTree {
  private rafCollector: ReturnType<typeof useRafFn>
  private resumeEndRunId: ReturnType<typeof setTimeout> | undefined
  public browserTestsStartTime: number
  constructor(
    public projects: string[] = [],
    public colors = new Map<string, string | undefined>(),
    private onTaskUpdateCalled: boolean = false,
    private resumeEndTimeout = 500,
    public root = <RootTreeNode>{
      id: 'vitest-root-node',
      expandable: true,
      expanded: true,
      tasks: [],
    },
    public pendingTasks = new Map<string, Set<string>>(),
    public nodes = new Map<string, UITaskTreeNode>(),
    public summary = reactive<CollectorInfo>({
      files: 0,
      time: '',
      filesFailed: 0,
      filesSuccess: 0,
      filesIgnore: 0,
      filesRunning: 0,
      filesSkipped: 0,
      filesSnapshotFailed: 0,
      filesTodo: 0,
      testsFailed: 0,
      testsSuccess: 0,
      testsIgnore: 0,
      testsSkipped: 0,
      testsTodo: 0,
      totalTests: 0,
      failedSnapshot: false,
      failedSnapshotEnabled: false,
    }),
  ) {
    this.browserTestsStartTime = performance.now()
    // will run runCollect every ~100ms: 1000/10 = 100ms
    // (beware increasing fpsLimit, it can be too much for the browser)
    this.rafCollector = useRafFn(this.runCollect.bind(this), { fpsLimit: 10, immediate: false })
  }

  startBrowserTimer() {
    if (config.value.browser) {
      this.browserTestsStartTime = performance.now()
    }
  }

  stopBrowserTimer() {
    if (config.value.browser) {
      // Note: This measures the wall-clock time from the UI's perspective (from test
      // run trigger to "finished" event), which is the most accurate measure of the
      // perceived developer experience. It will naturally be higher than the duration
      // reported in the terminal, as it includes the entire browser test orchestration:
      // - Network latency (UI -> Server -> UI)
      // - Browser iframe creation and orchestration
      // - Broadcast channel communication between the UI and the test iframe.
      // The terminal reporter, in contrast, only aggregates the pure test execution
      // time reported by the browser orchestrator.
      const browserTime = performance.now() - this.browserTestsStartTime
      this.summary.time = browserTime > 1000 ? `${(browserTime / 1000).toFixed(2)}s` : `${Math.round(browserTime)}ms`
    }
  }

  loadFiles(remoteFiles: File[], projects: { name: string; color?: string }[]) {
    this.projects.splice(0, this.projects.length, ...projects.map(p => p.name))
    this.colors = new Map(projects.map(p => [p.name, p.color]))

    runLoadFiles(
      remoteFiles,
      true,
      search.value.trim(),
      {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
      },
    )
  }

  startRun() {
    this.startBrowserTimer()
    this.resumeEndRunId = setTimeout(() => this.endRun(), this.resumeEndTimeout)
    this.collect(true, false)
  }

  annotateTest(testId: string, annotation: TestAnnotation) {
    annotateTest(testId, annotation)
    if (!this.onTaskUpdateCalled) {
      clearTimeout(this.resumeEndRunId)
      this.onTaskUpdateCalled = true
      this.collect(true, false, false)
      this.rafCollector.resume()
    }
  }

  resumeRun(packs: TaskResultPack[], _events: RunnerTaskEventPack[]) {
    preparePendingTasks(packs)
    if (!this.onTaskUpdateCalled) {
      clearTimeout(this.resumeEndRunId)
      this.onTaskUpdateCalled = true
      this.collect(true, false, false)
      this.rafCollector.resume()
    }
  }

  endRun() {
    this.rafCollector.pause()
    this.onTaskUpdateCalled = false
    this.stopBrowserTimer()
    this.collect(false, true)
  }

  private runCollect() {
    this.collect(false, false)
  }

  private collect(start: boolean, end: boolean, task = true) {
    if (task) {
      queueMicrotask(() => {
        runCollect(
          start,
          end,
          this.summary,
          search.value.trim(),
          {
            failed: filter.failed,
            success: filter.success,
            skipped: filter.skipped,
            onlyTests: filter.onlyTests,
          },
        )
      })
    }
    else {
      runCollect(
        start,
        end,
        this.summary,
        search.value.trim(),
        {
          failed: filter.failed,
          success: filter.success,
          skipped: filter.skipped,
          onlyTests: filter.onlyTests,
        },
      )
    }
  }

  collectTestsTotal(
    filtered: boolean,
    onlyTests: boolean,
    tests: File[],
    filesSummary: FilteredTests,
  ) {
    return collectTestsTotalData(filtered, onlyTests, tests, filesSummary, search.value.trim(), {
      failed: filter.failed,
      success: filter.success,
      skipped: filter.skipped,
      onlyTests: filter.onlyTests,
    })
  }

  collapseNode(id: string) {
    queueMicrotask(() => {
      runCollapseNode(id)
    })
  }

  expandNode(id: string) {
    queueMicrotask(() => {
      runExpandNode(id, search.value.trim(), {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
      })
    })
  }

  collapseAllNodes() {
    queueMicrotask(() => {
      runCollapseAllTask()
    })
  }

  expandAllNodes() {
    queueMicrotask(() => {
      runExpandAll(search.value.trim(), {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
      })
    })
  }

  filterNodes() {
    queueMicrotask(() => {
      runFilter(search.value.trim(), {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
      })
    })
  }
}
