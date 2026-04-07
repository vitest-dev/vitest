import type { File, TaskResultPack, TestArtifact } from '@vitest/runner'
import type { RunnerTaskEventPack } from 'vitest'
import type {
  CollectorInfo,
  FilteredTests,
  RootTreeNode,
  UITaskTreeNode,
} from '~/composables/explorer/types'
import { useRafFn } from '@vueuse/core'
import { reactive } from 'vue'
import { runCollapseAllTask, runCollapseNode } from '~/composables/explorer/collapse'
import { collectTestsTotalData, preparePendingTasks, recordTestArtifact, runCollect, runLoadFiles } from '~/composables/explorer/collector'
import { runExpandAll, runExpandNode } from '~/composables/explorer/expand'
import { runFilter } from '~/composables/explorer/filter'
import {
  filter,
  searchMatcher,
} from '~/composables/explorer/state'

export class ExplorerTree {
  private rafCollector: ReturnType<typeof useRafFn>
  private resumeEndRunId: ReturnType<typeof setTimeout> | undefined
  public startTime: number = 0
  public executionTime: number = 0
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
      testsExpectedFail: 0,
      testsSlow: 0,
      totalTests: 0,
      failedSnapshot: false,
      failedSnapshotEnabled: false,
    }),
  ) {
    // will run runCollect every ~100ms: 1000/10 = 100ms
    // (beware increasing fpsLimit, it can be too much for the browser)
    this.rafCollector = useRafFn(this.runCollect.bind(this), { fpsLimit: 10, immediate: false })
  }

  loadFiles(remoteFiles: File[], projects: { name: string; color?: string }[]) {
    this.projects.splice(0, this.projects.length, ...projects.map(p => p.name))
    this.colors = new Map(projects.map(p => [p.name, p.color]))

    runLoadFiles(
      remoteFiles,
      true,
      searchMatcher.value.matcher,
      {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        slow: filter.slow,
        onlyTests: filter.onlyTests,
      },
    )
  }

  startRun() {
    this.startTime = performance.now()
    this.resumeEndRunId = setTimeout(() => this.endRun(), this.resumeEndTimeout)
    this.collect(true, false)
  }

  recordTestArtifact(testId: string, artifact: TestArtifact) {
    recordTestArtifact(testId, artifact)
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

  endRun(executionTime = performance.now() - this.startTime) {
    this.executionTime = executionTime
    this.rafCollector.pause()
    this.onTaskUpdateCalled = false
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
          searchMatcher.value.matcher,
          {
            failed: filter.failed,
            success: filter.success,
            skipped: filter.skipped,
            slow: filter.slow,
            onlyTests: filter.onlyTests,
          },
          end ? this.executionTime : performance.now() - this.startTime,
        )
      })
    }
    else {
      runCollect(
        start,
        end,
        this.summary,
        searchMatcher.value.matcher,
        {
          failed: filter.failed,
          success: filter.success,
          skipped: filter.skipped,
          slow: filter.slow,
          onlyTests: filter.onlyTests,
        },
        end ? this.executionTime : performance.now() - this.startTime,
      )
    }
  }

  collectTestsTotal(
    filtered: boolean,
    onlyTests: boolean,
    tests: File[],
    filesSummary: FilteredTests,
  ) {
    return collectTestsTotalData(filtered, onlyTests, tests, filesSummary, searchMatcher.value.matcher, {
      failed: filter.failed,
      success: filter.success,
      skipped: filter.skipped,
      slow: filter.slow,
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
      runExpandNode(id, searchMatcher.value.matcher, {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        slow: filter.slow,
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
      runExpandAll(searchMatcher.value.matcher, {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        slow: filter.slow,
        onlyTests: filter.onlyTests,
      })
    })
  }

  filterNodes() {
    queueMicrotask(() => {
      runFilter(searchMatcher.value.matcher, {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        slow: filter.slow,
        onlyTests: filter.onlyTests,
      })
    })
  }
}
