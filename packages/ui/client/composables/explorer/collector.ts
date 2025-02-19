import type { File, Task, TaskResultPack, Test } from '@vitest/runner'
import type { Arrayable } from '@vitest/utils'
import type { CollectFilteredTests, CollectorInfo, Filter, FilteredTests } from '~/composables/explorer/types'
import { isTestCase } from '@vitest/runner/utils'
import { toArray } from '@vitest/utils'
import { hasFailedSnapshot } from '@vitest/ws-client'
import { client, findById } from '~/composables/client'
import { testRunState } from '~/composables/client/state'
import { expandNodesOnEndRun } from '~/composables/explorer/expand'
import { runFilter, testMatcher } from '~/composables/explorer/filter'
import { explorerTree } from '~/composables/explorer/index'
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
} from '~/composables/explorer/utils'
import { isSuite } from '~/utils/task'

export function runLoadFiles(
  remoteFiles: File[],
  collect: boolean,
  search: string,
  filter: Filter,
) {
  remoteFiles.map(f => [`${f.filepath}:${f.projectName || ''}`, f] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, f]) => createOrUpdateFileNode(f, collect))

  uiFiles.value = [...explorerTree.root.tasks]
  runFilter(search.trim(), {
    failed: filter.failed,
    success: filter.success,
    skipped: filter.skipped,
    onlyTests: filter.onlyTests,
  })
}

export function preparePendingTasks(packs: TaskResultPack[]) {
  queueMicrotask(() => {
    const pending = explorerTree.pendingTasks
    const idMap = client.state.idMap
    for (const pack of packs) {
      const result = pack[1]
      if (result) {
        const task = idMap.get(pack[0])
        if (task) {
          let file = pending.get(task.file.id)
          if (!file) {
            file = new Set()
            pending.set(task.file.id, file)
          }
          file.add(task.id)
        }
      }
    }
  })
}

export function runCollect(
  start: boolean,
  end: boolean,
  summary: CollectorInfo,
  search: string,
  filter: Filter,
) {
  if (start) {
    resetCollectorInfo(summary)
  }

  const collect = !start
  queueMicrotask(() => {
    if (end) {
      traverseFiles(collect)
    }
    else {
      traverseReceivedFiles(collect)
    }
  })

  queueMicrotask(() => {
    collectData(summary)
  })

  queueMicrotask(() => {
    if (end) {
      summary.failedSnapshot = uiFiles.value && hasFailedSnapshot(
        uiFiles.value.map(f => findById(f.id)!),
      )
      summary.failedSnapshotEnabled = true
    }
  })

  queueMicrotask(() => {
    doRunFilter(search, filter, end)
  })
}

function* collectRunningTodoTests() {
  yield * uiEntries.value.filter(isRunningTestNode)
}

function updateRunningTodoTests() {
  const idMap = client.state.idMap
  let task: Task | undefined
  for (const test of collectRunningTodoTests()) {
    // lookup the parent
    task = idMap.get(test.parentId)
    if (task && isSuite(task) && task.mode === 'todo') {
      task = idMap.get(test.id)
      if (task) {
        task.mode = 'todo'
      }
    }
  }
}

function traverseFiles(collect: boolean) {
  // add missing files: now we have only files with running tests on the initial ws open event
  const files = client.state.getFiles()
  const currentFiles = explorerTree.nodes
  const missingFiles = files.filter(f => !currentFiles.has(f.id))
  for (let i = 0; i < missingFiles.length; i++) {
    createOrUpdateFileNode(missingFiles[i], collect)
    createOrUpdateEntry(missingFiles[i].tasks)
  }

  // update pending tasks
  const rootTasks = explorerTree.root.tasks
  // collect remote children
  for (let i = 0; i < rootTasks.length; i++) {
    const fileNode = rootTasks[i]
    const file = findById(fileNode.id)
    if (!file) {
      continue
    }

    createOrUpdateFileNode(file, collect)
    const tasks = file.tasks
    if (!tasks?.length) {
      continue
    }

    createOrUpdateEntry(file.tasks)
  }
}

function traverseReceivedFiles(collect: boolean) {
  const updatedFiles = new Map(explorerTree.pendingTasks.entries())
  explorerTree.pendingTasks.clear()

  // add missing files: now we have only files with running tests on the initial ws open event
  const currentFiles = explorerTree.nodes
  const missingFiles = Array
    .from(updatedFiles.keys())
    .filter(id => !currentFiles.has(id))
    .map(id => findById(id))
    .filter(Boolean) as File[]

  let newFile: File
  for (let i = 0; i < missingFiles.length; i++) {
    newFile = missingFiles[i]
    createOrUpdateFileNode(newFile, false)
    createOrUpdateEntry(newFile.tasks)
    // remove the file from the updated files
    updatedFiles.delete(newFile.id)
  }

  // collect remote children
  const idMap = client.state.idMap
  const rootTasks = explorerTree.root.tasks
  for (let i = 0; i < rootTasks.length; i++) {
    const fileNode = rootTasks[i]
    const file = findById(fileNode.id)
    if (!file) {
      continue
    }
    const entries = updatedFiles.get(file.id)
    if (!entries) {
      continue
    }
    createOrUpdateFileNode(file, collect)
    createOrUpdateEntry(Array.from(entries).map(id => idMap.get(id)).filter(Boolean) as Task[])
  }
}

function doRunFilter(
  search: string,
  filter: Filter,
  end = false,
) {
  const expandAll = treeFilter.value.expandAll
  const resetExpandAll = expandAll !== true
  const ids = new Set(openedTreeItems.value)
  const applyExpandNodes = (ids.size > 0 && expandAll === false) || resetExpandAll

  // refresh explorer
  queueMicrotask(() => {
    refreshExplorer(search, filter, end)
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
      refreshExplorer(search, filter, end)
    })
  }
}

function refreshExplorer(search: string, filter: Filter, end: boolean) {
  runFilter(search, filter)
  // update only at the end
  if (end) {
    updateRunningTodoTests()
    testRunState.value = 'idle'
  }
}

function createOrUpdateEntry(tasks: Task[]) {
  let task: Task
  for (let i = 0; i < tasks.length; i++) {
    task = tasks[i]
    if (isSuite(task)) {
      createOrUpdateSuiteTask(task.id, true)
    }
    else {
      createOrUpdateNodeTask(task.id)
    }
  }
}

export function resetCollectorInfo(summary: CollectorInfo) {
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
  summary.totalTests = 0
  summary.failedSnapshotEnabled = false
}

function collectData(summary: CollectorInfo) {
  const idMap = client.state.idMap
  const filesMap = new Map(explorerTree.root.tasks.filter(f => idMap.has(f.id)).map(f => [f.id, f]))
  const useFiles = Array.from(filesMap.values()).map(file => [file.id, findById(file.id)] as const)
  const data = {
    files: filesMap.size,
    time: '',
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
    totalTests: 0,
    failedSnapshot: false,
    failedSnapshotEnabled: false,
  } satisfies CollectorInfo

  let time = 0
  for (const [id, f] of useFiles) {
    if (!f) {
      continue
    }
    const file = filesMap.get(id)
    if (file) {
      file.mode = f.mode
      file.setupDuration = f.setupDuration
      file.prepareDuration = f.prepareDuration
      file.environmentLoad = f.environmentLoad
      file.collectDuration = f.collectDuration
      file.duration = f.result?.duration != null ? Math.round(f.result?.duration) : undefined
      file.state = f.result?.state
    }
    time += Math.max(0, f.collectDuration || 0)
    time += Math.max(0, f.setupDuration || 0)
    time += Math.max(0, f.result?.duration || 0)
    time += Math.max(0, f.environmentLoad || 0)
    time += Math.max(0, f.prepareDuration || 0)
    data.time = time > 1000 ? `${(time / 1000).toFixed(2)}s` : `${Math.round(time)}ms`
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
    } = collectTests(f)

    data.totalTests += total
    data.testsFailed += failed
    data.testsSuccess += success
    data.testsSkipped += skipped
    data.testsTodo += todo
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
  summary.testsFailed = data.testsFailed
  summary.testsTodo = data.testsTodo
  summary.testsIgnore = data.testsIgnore
  summary.testsSkipped = data.testsSkipped
  summary.totalTests = data.totalTests
}

function collectTests(file: File, search = '', filter?: Filter) {
  const data = {
    failed: 0,
    success: 0,
    skipped: 0,
    running: 0,
    total: 0,
    ignored: 0,
    todo: 0,
  } satisfies CollectFilteredTests

  for (const t of testsCollector(file)) {
    if (!filter || testMatcher(t, search, filter)) {
      data.total++
      if (t.result?.state === 'fail') {
        data.failed++
      }
      else if (t.result?.state === 'pass') {
        data.success++
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

  data.running = data.total - data.failed - data.success - data.ignored

  return data
}

export function collectTestsTotalData(
  filtered: boolean,
  onlyTests: boolean,
  tests: File[],
  filesSummary: FilteredTests,
  search: string,
  filter: Filter,
) {
  if (onlyTests) {
    // todo: apply similar logic when filtered
    return tests
      .map(file => collectTests(file, search, filter))
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
    if (isTestCase(s)) {
      yield s
    }
    else {
      yield * testsCollector(s.tasks)
    }
  }
}
