import type { RunnerTestFile as File, RunnerTaskEventPack, RunnerTaskResultPack as TaskResultPack, TestArtifact } from 'vitest'
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
  uiFiles,
} from '~/composables/explorer/state'
import { createOrUpdateFileNode, isParentNode, pruneRemovedChildren, removeNodeSubtree } from '~/composables/explorer/utils'

export class ExplorerTree {
  private rafCollector: ReturnType<typeof useRafFn>
  private resumeEndRunId: ReturnType<typeof setTimeout> | undefined
  public startTime: number = 0
  public executionTime: number = 0
  constructor(
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

  loadFiles(remoteFiles: File[]) {
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

  /** Update collected files and prune tasks that no longer exist. */
  reconcileFiles(files: File[]) {
    for (let i = 0; i < files.length; i++) {
      this.reconcileFile(files[i])
    }
  }

  private reconcileFile(file: File) {
    createOrUpdateFileNode(file, true)
    const fileNode = this.nodes.get(file.id)
    if (fileNode && isParentNode(fileNode)) {
      pruneRemovedChildren(this.nodes, fileNode, file.tasks)
    }
  }

  /** Remove every project entry for a filepath and refresh the explorer state. */
  removeFile(filepath: string) {
    for (const fileNode of this.root.tasks.filter(file => file.filepath === filepath)) {
      removeNodeSubtree(this.nodes, fileNode)
      this.root.tasks.splice(this.root.tasks.indexOf(fileNode), 1)
    }
    uiFiles.value = [...this.root.tasks]
    this.collect(false, true)
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

  /**
   * Synchronize task nodes, summary counts, and filtered entries with the runner state.
   *
   * @param start Reset summary counters before updates when true; skip the reset when false.
   * @param end Traverse every file and finalize the run when true; process only pending files when false.
   * @param task Invoke the collector in a microtask when true; invoke it immediately when false.
   */
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
