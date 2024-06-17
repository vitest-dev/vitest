import type { Custom, File, Task, Test } from '@vitest/runner'
import { isAtomTest } from '@vitest/runner/utils'
import type { Arrayable } from '@vitest/utils'
import { toArray } from '@vitest/utils'
import { hasFailedSnapshot } from '@vitest/ws-client'
import type {
  CollectFilteredTests,
  CollectorInfo,
  FileTreeNode,
  Filter,
  FilteredTests,
  UITaskTreeNode,
} from '~/composables/explorer/types'
import { client, findById } from '~/composables/client'
import { runFilter, testMatcher } from '~/composables/explorer/filter'
import {
  createOrUpdateFileNode,
  createOrUpdateNodeTask,
  createOrUpdateSuiteTask,
} from '~/composables/explorer/utils'
import { isSuite } from '~/utils/task'
import { openedTreeItems, treeFilter, uiFiles } from '~/composables/explorer/state'
import { expandNodesOnEndRun } from '~/composables/explorer/expand'

export function runLoadFiles(
  remoteFiles: File[],
  rootTasks: FileTreeNode[],
  nodes: Map<string, UITaskTreeNode>,
  search: string,
  filter: Filter,
) {
  remoteFiles.map(f => [`${f.filepath}:${f.projectName || ''}`, f] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, f]) => createOrUpdateFileNode(f, nodes, rootTasks))

  uiFiles.value = [...rootTasks]
  queueMicrotask(() => {
    runFilter(rootTasks, nodes, search.trim(), {
      failed: filter.failed,
      success: filter.success,
      skipped: filter.skipped,
      onlyTests: filter.onlyTests,
    })
  })
}

export function runCollect(
  start: boolean,
  end: boolean,
  rootTasks: FileTreeNode[],
  nodes: Map<string, UITaskTreeNode>,
  summary: CollectorInfo,
  search: string,
  filter: Filter,
) {
  if (start)
    queueMicrotask(() => resetCollectorInfo(summary))

  queueMicrotask(() => {
    // collect remote children
    for (let i = 0; i < rootTasks.length; i++) {
      const fileNode = rootTasks[i]
      const file = findById(fileNode.id)
      if (!file)
        continue

      createOrUpdateFileNode(file, nodes, rootTasks, !start)
      const tasks = file.tasks
      if (!tasks?.length)
        continue

      createOrUpdateEntry(file.tasks, nodes)
    }
  })

  queueMicrotask(() => {
    collectData(rootTasks, summary)
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
    doRunFilter(rootTasks, nodes, search, filter)
  })
}

function doRunFilter(
  rootTasks: FileTreeNode[],
  nodes: Map<string, UITaskTreeNode>,
  search: string,
  filter: Filter,
  end = false,
) {
  // refresh explorer

  const expandAll = treeFilter.value.expandAll
  const filtered = search.trim().length > 0 || filter.failed || filter.success || filter.skipped || filter.onlyTests
  const resetExpandAll = expandAll !== true
  const ids = new Set(openedTreeItems.value)
  const applyExpandNodes = (ids.size > 0 && expandAll === false) || resetExpandAll

  // refresh explorer
  queueMicrotask(() => {
    runFilter(rootTasks, nodes, search, filter)
  })

  // expand all nodes
  queueMicrotask(() => {
    if (applyExpandNodes) {
      expandNodesOnEndRun(ids, nodes, end)
      if (resetExpandAll || filtered)
        treeFilter.value.expandAll = false
    }
  })

  // refresh explorer
  if (applyExpandNodes)
    queueMicrotask(() => runFilter(rootTasks, nodes, search, filter))
}

function createOrUpdateEntry(tasks: Task[], nodes: Map<string, UITaskTreeNode>) {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    if (isSuite(task))
      createOrUpdateSuiteTask(task.id, nodes, true)
    else
      createOrUpdateNodeTask(task.id, nodes)
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

function collectData(
  files: FileTreeNode[],
  summary: CollectorInfo,
) {
  const idMap = client.state.idMap
  const filesMap = new Map(files.filter(f => idMap.has(f.id)).map(f => [f.id, f]))
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
    if (!f)
      continue
    const file = filesMap.get(id)
    if (file) {
      file.mode = f.mode
      file.setupDuration = f.setupDuration
      file.prepareDuration = f.prepareDuration
      file.environmentLoad = f.environmentLoad
      file.collectDuration = f.collectDuration
      file.duration = f.result?.duration
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

function* testsCollector(suite: Arrayable<Task>): Generator<Test | Custom> {
  const arraySuites = toArray(suite)
  for (const s of arraySuites) {
    if (isAtomTest(s)) {
      yield s
    }
    else {
      for (const task of s.tasks) {
        if (isAtomTest(task))
          yield task
        else
          yield * testsCollector(task)
      }
    }
  }
}
