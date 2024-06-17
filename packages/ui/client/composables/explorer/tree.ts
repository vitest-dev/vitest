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
  private resumeEndRunId: ReturnType<typeof setTimeout> | undefined
  constructor(
    // if the user refreshes the page with finished tests, we don't receive onFinished event
    // maybe we should send the event/data from the server when the client reconnects
    // todo: remove this and resumeEndRunId when vitest runner fix the problem
    // todo: remove also client/index.ts logic with onTaskUpdateCalled
    private resumeEndTimeout = 500,
    private done = new Set<string>(),
    private root = <RootTreeNode>{
      id: 'vitest-root-node',
      expandable: true,
      expanded: true,
      tasks: [],
    },
    private nodes = new Map<string, UITaskTreeNode>(),
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
    runLoadFiles(remoteFiles, this.root.tasks, this.nodes, search.value.trim(), {
      failed: filter.failed,
      success: filter.success,
      skipped: filter.skipped,
      onlyTests: filter.onlyTests,
    })
  }

  resumeRun() {
    clearTimeout(this.resumeEndRunId)
    this.rafCollector.resume()
  }

  endRun() {
    clearTimeout(this.resumeEndRunId)
    // collect final state: rafCollector can be null on page refresh
    this.rafCollector.pause()
    this.collect(false, true)
  }

  private runCollect() {
    this.collect(false, false)
  }

  private collect(start: boolean, end: boolean) {
    queueMicrotask(() => {
      runCollect(
        start,
        end,
        this.root.tasks,
        this.nodes,
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

  startRun(registerResumeEndRun = false) {
    if (registerResumeEndRun)
      this.resumeEndRunId = setTimeout(() => this.endRun(), this.resumeEndTimeout)

    this.collect(true, false)
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
      runCollapseNode(id, this.nodes)
    })
  }

  expandNode(id: string) {
    queueMicrotask(() => {
      runExpandNode(id, this.nodes, search.value.trim(), {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
      })
    })
  }

  collapseAllNodes() {
    queueMicrotask(() => {
      runCollapseAllTask(this.root.tasks)
    })
  }

  expandAllNodes() {
    queueMicrotask(() => {
      runExpandAll(this.root.tasks, this.nodes, search.value.trim(), {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
      })
    })
  }

  filterNodes() {
    queueMicrotask(() => {
      runFilter(this.root.tasks, this.nodes, search.value.trim(), {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        onlyTests: filter.onlyTests,
      })
    })
  }
}
