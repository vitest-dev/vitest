import type { RunnerTestFile as File, RunnerTask, RunnerTaskEventPack, RunnerTaskResultPack as TaskResultPack, TestArtifact } from 'vitest'
import type {
  CollectorInfo,
  ExplorerDataSource,
  ExplorerOperationContext,
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
import { isFileNode } from '~/composables/explorer/utils'
import { isSuite as isTaskSuite } from '~/utils/task'
import { getTasks } from '../../../../vitest/src/utils/tasks'

export class ExplorerTree {
  private rafCollector: ReturnType<typeof useRafFn>
  private resumeEndRunId: ReturnType<typeof setTimeout> | undefined
  private startTime: number = 0
  public executionTime: number = 0
  public projects: string[] = []
  public colors = new Map<string, string | undefined>()
  private onTaskUpdateCalled: boolean = false
  private root = <RootTreeNode>{
    id: 'vitest-root-node',
    expandable: true,
    expanded: true,
    tasks: [],
  }

  private pendingTasks = new Map<string, Set<string>>()
  private nodes = new Map<string, UITaskTreeNode>()
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
  })

  constructor(
    private dataSource?: ExplorerDataSource,
    private resumeEndTimeout = 500,
  ) {
    // will run runCollect every ~100ms: 1000/10 = 100ms
    // (beware increasing fpsLimit, it can be too much for the browser)
    this.rafCollector = useRafFn(this.runCollect.bind(this), { fpsLimit: 10, immediate: false })
  }

  connect(dataSource: ExplorerDataSource) {
    if (this.dataSource) {
      throw new Error('ExplorerTree data source is already configured')
    }
    this.dataSource = dataSource
  }

  private getContext(): ExplorerOperationContext {
    if (!this.dataSource) {
      throw new Error('ExplorerTree data source is not configured')
    }
    return {
      root: this.root,
      nodes: this.nodes,
      colors: this.colors,
      pendingTasks: this.pendingTasks,
      dataSource: this.dataSource,
    }
  }

  loadFiles(remoteFiles: File[], projects: { name: string; color?: string }[]) {
    this.projects.splice(0, this.projects.length, ...projects.map(p => p.name))
    this.colors = new Map(projects.map(p => [p.name, p.color]))

    runLoadFiles(
      this.getContext(),
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
    this.getContext()
    this.startTime = performance.now()
    this.resumeEndRunId = setTimeout(() => this.endRun(), this.resumeEndTimeout)
    this.collect(true, false)
  }

  setRunStartTime(startTime?: number) {
    this.startTime = startTime || performance.now()
  }

  clearTaskResult(task: RunnerTask) {
    delete task.result
    const node = this.nodes.get(task.id)
    if (node) {
      node.state = undefined
      // update task mode to allow change icon on skipped tests
      task.mode = 'run'
      node.duration = undefined
      if (isTaskSuite(task)) {
        for (const child of task.tasks) {
          this.clearTaskResult(child)
        }
      }
    }
  }

  clearResults(files: File[]) {
    files.forEach((f) => {
      delete f.result
      getTasks(f).forEach((task) => {
        delete task.result
        const node = this.nodes.get(task.id)
        if (node) {
          node.state = undefined
          node.mode = 'run'
          node.duration = undefined
        }
      })
      const file = this.nodes.get(f.id)
      if (file) {
        file.state = undefined
        file.mode = 'run'
        file.duration = undefined
        if (isFileNode(file)) {
          file.collectDuration = undefined
        }
      }
    })
  }

  recordTestArtifact(testId: string, artifact: TestArtifact) {
    recordTestArtifact(this.getContext(), testId, artifact)
    if (!this.onTaskUpdateCalled) {
      clearTimeout(this.resumeEndRunId)
      this.onTaskUpdateCalled = true
      this.collect(true, false, false)
      this.rafCollector.resume()
    }
  }

  resumeRun(packs: TaskResultPack[], _events: RunnerTaskEventPack[]) {
    preparePendingTasks(this.getContext(), packs)
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
    const context = this.getContext()
    if (task) {
      queueMicrotask(() => {
        runCollect(
          context,
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
        context,
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
    return collectTestsTotalData(this.getContext(), filtered, onlyTests, tests, filesSummary, searchMatcher.value.matcher, {
      failed: filter.failed,
      success: filter.success,
      skipped: filter.skipped,
      slow: filter.slow,
      onlyTests: filter.onlyTests,
    })
  }

  collapseNode(id: string) {
    const context = this.getContext()
    queueMicrotask(() => {
      runCollapseNode(context, id)
    })
  }

  expandNode(id: string) {
    const context = this.getContext()
    queueMicrotask(() => {
      runExpandNode(context, id, searchMatcher.value.matcher, {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        slow: filter.slow,
        onlyTests: filter.onlyTests,
      })
    })
  }

  collapseAllNodes() {
    const context = this.getContext()
    queueMicrotask(() => {
      runCollapseAllTask(context)
    })
  }

  expandAllNodes() {
    const context = this.getContext()
    queueMicrotask(() => {
      runExpandAll(context, searchMatcher.value.matcher, {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        slow: filter.slow,
        onlyTests: filter.onlyTests,
      })
    })
  }

  filterNodes() {
    const context = this.getContext()
    queueMicrotask(() => {
      runFilter(context, searchMatcher.value.matcher, {
        failed: filter.failed,
        success: filter.success,
        skipped: filter.skipped,
        slow: filter.slow,
        onlyTests: filter.onlyTests,
      })
    })
  }
}
