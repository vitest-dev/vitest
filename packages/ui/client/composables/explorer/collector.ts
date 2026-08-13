import type { Arrayable } from '@vitest/utils'
import type { RunnerTestFile as File, RunnerTask as Task, RunnerTaskResultPack as TaskResultPack, RunnerTestCase as Test, TestArtifact } from 'vitest'
import type { CollectFilteredTests, CollectorInfo, ExplorerOperationContext, Filter, FilteredTests, SearchMatcher } from '~/composables/explorer/types'
import { toArray } from '@vitest/utils/helpers'
import { expandNodesOnEndRun } from '~/composables/explorer/expand'
import { runFilter, testMatcher } from '~/composables/explorer/filter'
import {
  initialized,
  openedTreeItems,
  treeFilter,
  uiEntries,
  uiFiles,
} from '~/composables/explorer/state'
import {
  createOrUpdateFileNode,
  createOrUpdateNodeTask,
  createOrUpdateSuiteTask,
  isRunningTestNode,
  isSlowTestTask,
} from '~/composables/explorer/utils'
import { isSuite } from '~/utils/task'
import { hasFailedSnapshot } from '../../../../vitest/src/utils/tasks'

export { hasFailedSnapshot }

export function runLoadFiles(
  context: ExplorerOperationContext,
  remoteFiles: File[],
  collect: boolean,
  search: SearchMatcher,
  filter: Filter,
) {
  remoteFiles.map(f => [`${f.filepath}:${f.projectName || ''}`, f] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, f]) => createOrUpdateFileNode(context, f, collect))

  uiFiles.value = [...context.root.tasks]
  runFilter(context, search, {
    failed: filter.failed,
    success: filter.success,
    skipped: filter.skipped,
    slow: filter.slow,
    onlyTests: filter.onlyTests,
  })
}

export function preparePendingTasks(context: ExplorerOperationContext, packs: TaskResultPack[]) {
  queueMicrotask(() => {
    for (const pack of packs) {
      const result = pack[1]
      if (result) {
        const task = context.dataSource.getTask(pack[0])
        if (task) {
          let file = context.pendingTasks.get(task.file.id)
          if (!file) {
            file = new Set()
            context.pendingTasks.set(task.file.id, file)
          }
          file.add(task.id)
        }
      }
    }
  })
}

export function recordTestArtifact(
  context: ExplorerOperationContext,
  id: string,
  artifact: TestArtifact,
) {
  const test = context.dataSource.getTask(id)
  if (test?.type === 'test') {
    let file = context.pendingTasks.get(test.file.id)
    if (!file) {
      file = new Set()
      context.pendingTasks.set(test.file.id, file)
    }
    file.add(test.id)

    if (artifact.type === 'internal:annotation') {
      test.annotations.push(artifact.annotation)
    }
    else {
      test.artifacts.push(artifact)
    }
  }
}

export function runCollect(
  context: ExplorerOperationContext,
  start: boolean,
  end: boolean,
  summary: CollectorInfo,
  search: SearchMatcher,
  filter: Filter,
  executionTime: number,
) {
  if (start) {
    resetCollectorInfo(summary)
  }

  const collect = !start
  queueMicrotask(() => {
    if (end) {
      traverseFiles(context, collect)
    }
    else {
      traverseReceivedFiles(context, collect)
    }
  })

  queueMicrotask(() => {
    collectData(context, summary, executionTime)
  })

  queueMicrotask(() => {
    if (end) {
      summary.failedSnapshot = uiFiles.value && hasFailedSnapshot(
        uiFiles.value.map(f => context.dataSource.getFile(f.id)!),
      )
      summary.failedSnapshotEnabled = true
    }
  })

  queueMicrotask(() => {
    doRunFilter(context, search, filter, end)
  })
}

function* collectRunningTodoTests() {
  yield* uiEntries.value.filter(isRunningTestNode)
}

function updateRunningTodoTests(context: ExplorerOperationContext) {
  let task: Task | undefined
  for (const test of collectRunningTodoTests()) {
    // lookup the parent
    task = context.dataSource.getTask(test.parentId)
    if (task && isSuite(task) && task.mode === 'todo') {
      task = context.dataSource.getTask(test.id)
      if (task) {
        task.mode = 'todo'
      }
    }
  }
}

function traverseFiles(context: ExplorerOperationContext, collect: boolean) {
  // add missing files: now we have only files with running tests on the initial ws open event
  const files = context.dataSource.getFiles()
  const currentFiles = context.nodes
  const missingFiles = files.filter(f => !currentFiles.has(f.id))
  for (let i = 0; i < missingFiles.length; i++) {
    createOrUpdateFileNode(context, missingFiles[i], collect)
    createOrUpdateEntry(context, missingFiles[i].tasks)
  }

  // update pending tasks
  const rootTasks = context.root.tasks
  // collect remote children
  for (let i = 0; i < rootTasks.length; i++) {
    const fileNode = rootTasks[i]
    const file = context.dataSource.getFile(fileNode.id)
    if (!file) {
      continue
    }

    createOrUpdateFileNode(context, file, collect)
    const tasks = file.tasks
    if (!tasks?.length) {
      continue
    }

    createOrUpdateEntry(context, file.tasks)
  }
}

function traverseReceivedFiles(
  context: ExplorerOperationContext,
  collect: boolean,
) {
  const updatedFiles = new Map(context.pendingTasks.entries())
  context.pendingTasks.clear()

  // add missing files: now we have only files with running tests on the initial ws open event
  const currentFiles = context.nodes
  const missingFiles = Array
    .from(updatedFiles.keys())
    .filter(id => !currentFiles.has(id))
    .map(id => context.dataSource.getFile(id))
    .filter(Boolean) as File[]

  let newFile: File
  for (let i = 0; i < missingFiles.length; i++) {
    newFile = missingFiles[i]
    createOrUpdateFileNode(context, newFile, false)
    createOrUpdateEntry(context, newFile.tasks)
    // remove the file from the updated files
    updatedFiles.delete(newFile.id)
  }

  // collect remote children
  const rootTasks = context.root.tasks
  for (let i = 0; i < rootTasks.length; i++) {
    const fileNode = rootTasks[i]
    const file = context.dataSource.getFile(fileNode.id)
    if (!file) {
      continue
    }
    const entries = updatedFiles.get(file.id)
    if (!entries) {
      continue
    }
    createOrUpdateFileNode(context, file, collect)
    createOrUpdateEntry(context, Array.from(entries, id => context.dataSource.getTask(id)).filter(Boolean) as Task[])
  }
}

function doRunFilter(
  context: ExplorerOperationContext,
  search: SearchMatcher,
  filter: Filter,
  end = false,
) {
  const expandAll = treeFilter.value.expandAll
  const resetExpandAll = expandAll !== true
  const ids = new Set(openedTreeItems.value)
  const applyExpandNodes = (ids.size > 0 && expandAll === false) || resetExpandAll

  // refresh explorer
  queueMicrotask(() => {
    refreshExplorer(context, search, filter, end)
  })

  // initialize the explorer
  if (!initialized.value) {
    queueMicrotask(() => {
      if (uiEntries.value.length || end) {
        initialized.value = true
      }
    })
  }

  if (applyExpandNodes) {
    // expand all nodes
    queueMicrotask(() => {
      expandNodesOnEndRun(ids, end)
      if (resetExpandAll) {
        treeFilter.value.expandAll = false
      }
    })
    // refresh explorer
    queueMicrotask(() => {
      refreshExplorer(context, search, filter, end)
    })
  }
}

function refreshExplorer(context: ExplorerOperationContext, search: SearchMatcher, filter: Filter, end: boolean) {
  runFilter(context, search, filter)
  // update only at the end
  if (end) {
    updateRunningTodoTests(context)
    context.dataSource.setRunState('idle')
  }
}

function createOrUpdateEntry(context: ExplorerOperationContext, tasks: Task[]) {
  let task: Task
  for (let i = 0; i < tasks.length; i++) {
    task = tasks[i]
    if (isSuite(task)) {
      createOrUpdateSuiteTask(context, task.id, true)
    }
    else {
      createOrUpdateNodeTask(context, task.id)
    }
  }
}

function resetCollectorInfo(summary: CollectorInfo) {
  summary.files = 0
  summary.time = ''
  summary.filesFailed = 0
  summary.filesSuccess = 0
  summary.filesIgnore = 0
  summary.filesRunning = 0
  summary.filesSkipped = 0
  summary.filesTodo = 0
  summary.testsFailed = 0
  summary.testsSuccess = 0
  summary.testsIgnore = 0
  summary.testsSkipped = 0
  summary.testsTodo = 0
  summary.testsExpectedFail = 0
  summary.testsSlow = 0
  summary.totalTests = 0
  summary.failedSnapshotEnabled = false
}

function collectData(
  context: ExplorerOperationContext,
  summary: CollectorInfo,
  time: number,
) {
  const filesMap = new Map(context.root.tasks.filter(f => context.dataSource.getFile(f.id)).map(f => [f.id, f]))
  const useFiles = Array.from(filesMap.values(), file => [file.id, context.dataSource.getFile(file.id)] as const)
  const data = {
    files: filesMap.size,
    time: time > 1000 ? `${(time / 1000).toFixed(2)}s` : `${Math.round(time)}ms`,
    filesFailed: 0,
    filesSuccess: 0,
    filesIgnore: 0,
    filesRunning: 0,
    filesSkipped: 0,
    filesTodo: 0,
    filesSnapshotFailed: 0,
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
  } satisfies CollectorInfo

  for (const [_, f] of useFiles) {
    if (!f) {
      continue
    }
    if (f.result?.state === 'fail') {
      data.filesFailed++
    }
    else if (f.result?.state === 'pass') {
      data.filesSuccess++
    }
    else if (f.mode === 'skip') {
      data.filesIgnore++
      data.filesSkipped++
    }
    else if (f.mode === 'todo') {
      data.filesIgnore++
      data.filesTodo++
    }
    else {
      data.filesRunning++
    }

    const {
      failed,
      success,
      skipped,
      total,
      ignored,
      todo,
      expectedFail,
      slow,
    } = collectTests(context, f)

    data.totalTests += total
    data.testsFailed += failed
    data.testsSuccess += success
    data.testsSkipped += skipped
    data.testsTodo += todo
    data.testsExpectedFail += expectedFail
    data.testsSlow += slow
    data.testsIgnore += ignored
  }

  summary.files = data.files
  summary.time = data.time
  summary.filesFailed = data.filesFailed
  summary.filesSuccess = data.filesSuccess
  summary.filesIgnore = data.filesIgnore
  summary.filesRunning = data.filesRunning
  summary.filesSkipped = data.filesSkipped
  summary.filesTodo = data.filesTodo
  summary.testsFailed = data.testsFailed
  summary.testsSuccess = data.testsSuccess
  summary.testsTodo = data.testsTodo
  summary.testsExpectedFail = data.testsExpectedFail
  summary.testsSlow = data.testsSlow
  summary.testsIgnore = data.testsIgnore
  summary.testsSkipped = data.testsSkipped
  summary.totalTests = data.totalTests
}

function collectTests(context: ExplorerOperationContext, file: File, search: SearchMatcher = () => true, filter?: Filter) {
  const data = {
    failed: 0,
    success: 0,
    skipped: 0,
    running: 0,
    total: 0,
    ignored: 0,
    todo: 0,
    expectedFail: 0,
    slow: 0,
  } satisfies CollectFilteredTests

  for (const t of testsCollector(file)) {
    if (!filter || testMatcher(context, t, search, filter)) {
      data.total++
      if (isSlowTestTask(context, t)) {
        data.slow++
      }
      if (t.result?.state === 'fail') {
        data.failed++
      }
      else if (t.result?.state === 'pass') {
        // Check if this is an expected failure
        if (t.fails) {
          data.expectedFail++
        }
        else {
          data.success++
        }
      }
      else if (t.mode === 'skip') {
        data.ignored++
        data.skipped++
      }
      else if (t.mode === 'todo') {
        data.ignored++
        data.todo++
      }
    }
  }

  data.running = data.total - data.failed - data.success - data.ignored - data.expectedFail

  return data
}

export function collectTestsTotalData(
  context: ExplorerOperationContext,
  filtered: boolean,
  onlyTests: boolean,
  tests: File[],
  filesSummary: FilteredTests,
  search: SearchMatcher,
  filter: Filter,
) {
  if (onlyTests) {
    // todo: apply similar logic when filtered
    return tests
      .map(file => collectTests(context, file, search, filter))
      .reduce((acc, {
        failed,
        success,
        ignored,
        running,
      }) => {
        acc.failed += failed
        acc.success += success
        acc.skipped += ignored
        acc.running += running
        return acc
      }, { failed: 0, success: 0, skipped: 0, running: 0 })
  }
  else if (filtered) {
    const data = {
      failed: 0,
      success: 0,
      skipped: 0,
      running: 0,
    } satisfies FilteredTests
    // will match when the filter entry is active or filter is inactive (skipped excluded)
    // for example, we should update all when the filter is empty
    // but shouldn't update failed if we're filtering by success
    const empty = !filter.success && !filter.failed
    const applyFailed = filter.failed || empty
    const applySuccess = filter.success || empty
    for (const f of tests) {
      if (f.result?.state === 'fail') {
        data.failed += applyFailed ? 1 : 0
      }
      else if (f.result?.state === 'pass') {
        data.success += applySuccess ? 1 : 0
      }
      else if (f.mode === 'skip' || f.mode === 'todo') {
        // just ignore
      }
      else {
        data.running++
      }
    }

    return data
  }

  return filesSummary
}

function* testsCollector(suite: Arrayable<Task>): Generator<Test> {
  const arraySuites = toArray(suite)
  let s: Task
  for (let i = 0; i < arraySuites.length; i++) {
    s = arraySuites[i]
    if (s.type === 'test') {
      yield s
    }
    else {
      yield* testsCollector(s.tasks)
    }
  }
}
