import type { File, TaskResultPack } from '@vitest/runner'
import type {
  CollectorInfo,
  FilteredTests,
  RootTreeNode,
  UITaskTreeNode,
} from '~/composables/explorer/types'
import { runCollapseAllTask, runCollapseNode } from '~/composables/explorer/collapse'
import { collectTestsTotalData, preparePendingTasks, runCollect, runLoadFiles } from '~/composables/explorer/collector'
import { runExpandAll, runExpandNode } from '~/composables/explorer/expand'
import { runFilter } from '~/composables/explorer/filter'
import {
  filter,
  search,
} from '~/composables/explorer/state'

export class ExplorerTree {
  private rafCollector: ReturnType<typeof useRafFn>
  private resumeEndRunId: ReturnType<typeof setTimeout> | undefined
  constructor(
    public projects: string[] = [],
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
    // will run runCollect every ~100ms: 1000/10 = 100ms
    // (beware increasing fpsLimit, it can be too much for the browser)
    this.rafCollector = useRafFn(this.runCollect.bind(this), { fpsLimit: 10, immediate: false })
  }

  loadFiles(remoteFiles: File[], projects: string[]) {
    this.projects.splice(0, this.projects.length, ...projects)
    runLoadFiles(
      remoteFiles,
      true,
      search.value.trim(),
      {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
        project: filter.project,
      },
    )
  }

  startRun() {
    this.resumeEndRunId = setTimeout(() => this.endRun(), this.resumeEndTimeout)
    this.collect(true, false)
  }

  resumeRun(packs: TaskResultPack[]) {
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
            project: filter.project,
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
          project: filter.project,
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
      project: filter.project,
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
        project: filter.project,
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
        project: filter.project,
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
        project: filter.project,
      })
    })
  }
}
