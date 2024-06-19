import type { File } from '@vitest/runner'
import {
  filter,
  search,
} from '~/composables/explorer/state'
import type {
  CollectorInfo,
  FilteredTests,
  RootTreeNode,
  UITaskTreeNode,
} from '~/composables/explorer/types'
import { collectTestsTotalData, runCollect, runLoadFiles } from '~/composables/explorer/collector'
import { runCollapseAllTask, runCollapseNode } from '~/composables/explorer/collapse'
import { runExpandAll, runExpandNode } from '~/composables/explorer/expand'
import { runFilter } from '~/composables/explorer/filter'

export class ExplorerTree {
  private rafCollector: ReturnType<typeof useRafFn>
  constructor(
    private onTaskUpdateCalled: boolean = false,
    private done = new Set<string>(),
    public root = <RootTreeNode>{
      id: 'vitest-root-node',
      expandable: true,
      expanded: true,
      tasks: [],
    },
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

  isUITaskDone(node: UITaskTreeNode) {
    return this.done.has(node.id)
  }

  taskDone(id: string) {
    this.done.add(id)
  }

  removeTaskDone(id: string) {
    this.done.delete(id)
  }

  clearDone() {
    this.done.clear()
  }

  loadFiles(remoteFiles: File[]) {
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
    this.collect(true, false)
  }

  resumeRun() {
    if (!this.onTaskUpdateCalled) {
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
