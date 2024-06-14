import type { Custom, File, RunMode, Task, TaskState, Test } from '@vitest/runner'
import { hasFailedSnapshot } from '@vitest/ws-client'
import { client, findById } from '~/composables/client'
import { allExpanded, filteredFiles } from '~/composables/explorer/state'

export const uiFiles = shallowRef<FileTreeNode[]>([])
export const uiEntries = shallowRef<UITaskTreeNode[]>([])
/*
export function prepareUIEntries(remoteFiles: File[], cb: () => void) {
  uiFiles.value = remoteFiles.map<UIFile>(file => ({
    id: file.id,
    name: file.name,
    mode: file.mode,
    state: file.result?.state,
    filepath: file.filepath,
    projectName: file.projectName || '',
    collectDuration: file.collectDuration,
    setupDuration: file.setupDuration,
    expandable: true,
    expanded: false,
    tasks: [],
    indent: 0,
  })).sort((a, b) => {
    return a.name.localeCompare(b.name)
  })
  cb()
  uiEntries.value = [...uiFiles.value]
}
*/
export type TreeTaskMatcher = (node: UITaskTreeNode) => boolean

export interface TreeTaskFilter {
  /**
   * When this flag is true, only tests that match the filter are shown in the tree.
   * Any parent nodes that contain at least one child that matches the filter are also shown.
   * If this flag is false, all parent nodes are shown if at least one child matches the filter.
   * **NOTE**: this flag is ignored if `matcher` is not provided.
   */
  showOnlyTests?: boolean
  matcher?: TreeTaskMatcher
}

export interface TaskTreeNode {
  id: string
  expandable: boolean
  expanded: boolean
}

export interface RootTreeNode extends TaskTreeNode {
  tasks: FileTreeNode[]
}

export interface UITaskTreeNode extends TaskTreeNode {
  name: string
  parentId: string
  mode: RunMode
  indent: number
  state?: TaskState
  duration?: number
}

export interface ParentTreeNode extends UITaskTreeNode {
  tasks: UITaskTreeNode[]
}

export interface FileTreeNode extends ParentTreeNode {
  filepath: string
  projectName: string
  collectDuration?: number
  setupDuration?: number
  environmentLoad?: number
  prepareDuration?: number
}

type Nullable<T> = T | null | undefined
type Arrayable<T> = T | Array<T>

class TaskTree {
  public filter: TreeTaskFilter | undefined
  private rafCollector: ReturnType<typeof useRafFn>
  private reloadTasksId: ReturnType<typeof setTimeout> | undefined
  constructor(
    private root = <RootTreeNode>{
      id: 'vitest-root-node',
      expandable: true,
      expanded: true,
      tasks: [],
    },
    private nodes = new Map<string, UITaskTreeNode>(),
    public summary = reactive({
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
    this.rafCollector = useRafFn(this.collect.bind(this), { fpsLimit: 10, immediate: false })
    this.reloadTasksId = undefined
  }

  loadFiles(remoteFiles: File[]) {
    const files = remoteFiles.sort((a, b) => a.filepath.localeCompare(b.filepath))
    for (const file of files) {
      let fileNode = this.nodes.get(file.id) as FileTreeNode | undefined
      if (fileNode) {
        this.updateFile(file)
      }
      else {
        fileNode = {
          id: file.id,
          parentId: 'root',
          name: file.name,
          mode: file.mode,
          expandable: true,
          expanded: false,
          tasks: [],
          indent: 0,
          duration: file.result?.duration,
          filepath: file.filepath,
          projectName: file.projectName || '',
          collectDuration: file.collectDuration,
          setupDuration: file.setupDuration,
          environmentLoad: file.environmentLoad,
          prepareDuration: file.prepareDuration,
          state: file.result?.state,
        }
        this.insertFile(fileNode)
      }
    }

    uiFiles.value = [...this.root.tasks]
    uiEntries.value = this.collectTaskList()

    return files
  }

  private reloadTasks() {
    const files = Array
      .from(client.state.filesMap.values())
      .flat()
      .sort((a, b) => a.filepath.localeCompare(b.filepath))
    for (const file of files) {
      for (const task of file.tasks)
        this.createNodeTasks(file.id, task, true)
    }
  }

  resumeRun() {
    this.rafCollector.resume()
  }

  endRun() {
    // collect final state
    this.rafCollector.pause()
    this.collect()
    this.summary.failedSnapshot = uiFiles.value && hasFailedSnapshot(uiFiles.value.map(f => findById(f.id)!))
    this.summary.failedSnapshotEnabled = true
    // if all nodes already expanded, we just call expand logic
    if (allExpanded.value) {
      uiEntries.value = this.expandCollapseAll(true)
      nextTick(() => {
        filteredFiles.value = this.filteredFiles()
      })
    }
    else {
      // load and expand all pending tasks in the tree
      this.reloadTasks()
      // this will trigger a call to expandCollapseAll
      allExpanded.value = true
    }
  }

  private collect() {
    const idMap = client.state.idMap
    const filesMap = new Map(this.root.tasks.filter(f => idMap.has(f.id)).map(f => [f.id, f]))
    const useFiles = Array.from(filesMap.values()).map(file => [file.id, findById(file.id)] as const)
    const data = {
      files: filesMap.size,
      timeString: '',
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
    }
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
      data.timeString = time > 1000 ? `${(time / 1000).toFixed(2)}s` : `${Math.round(time)}ms`
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

      const tests = getTests(f)

      data.totalTests += tests.length

      for (const t of tests) {
        if (t.result?.state === 'fail') {
          data.testsFailed++
        }
        else if (t.result?.state === 'pass') {
          data.testsSuccess++
        }
        else if (t.mode === 'skip') {
          data.testsIgnore++
          data.testsSkipped++
        }
        else if (t.mode === 'todo') {
          data.testsIgnore++
          data.testsTodo++
        }
      }
    }

    this.summary.files = data.files
    this.summary.time = data.timeString
    this.summary.filesFailed = data.filesFailed
    this.summary.filesSuccess = data.filesSuccess
    this.summary.filesIgnore = data.filesIgnore
    this.summary.filesRunning = data.filesRunning
    this.summary.filesSkipped = data.filesSkipped
    this.summary.filesTodo = data.filesTodo
    this.summary.testsFailed = data.testsFailed
    this.summary.testsSuccess = data.testsSuccess
    this.summary.testsFailed = data.testsFailed
    this.summary.testsTodo = data.testsTodo
    this.summary.testsIgnore = data.testsIgnore
    this.summary.testsSkipped = data.testsSkipped
    this.summary.totalTests = data.totalTests
    clearTimeout(this.reloadTasksId)
    const entries = this.filter?.matcher && allExpanded.value
      ? this.expandCollapseAll(true)
      : undefined

    if (!entries)
      this.reloadTasks()

    // refresh tasks and filtered files
    this.reloadTasksId = setTimeout(() => {
      if (entries?.length)
        uiEntries.value = entries

      nextTick(() => {
        filteredFiles.value = this.filteredFiles()
      })
    }, 0)
  }

  startRun() {
    this.summary.files = 0
    this.summary.filesFailed = 0
    this.summary.filesSuccess = 0
    this.summary.filesIgnore = 0
    this.summary.filesRunning = 0
    this.summary.filesSkipped = 0
    this.summary.filesSnapshotFailed = 0
    this.summary.filesTodo = 0
    this.summary.testsFailed = 0
    this.summary.testsSuccess = 0
    this.summary.testsIgnore = 0
    this.summary.testsSkipped = 0
    this.summary.testsTodo = 0
    this.summary.totalTests = 0
    this.summary.failedSnapshotEnabled = false
    this.collect()
  }

  private isParentNode(node: TaskTreeNode): node is ParentTreeNode | RootTreeNode {
    return 'tasks' in node
  }

  private *tasksList(node: TaskTreeNode = this.root): Generator<UITaskTreeNode> {
    if (node !== this.root)
      yield node as UITaskTreeNode

    if (node.expandable && node.expanded && this.isParentNode(node) && node.tasks.length) {
      for (const child of node.tasks)
        yield * this.tasksList(child)
    }
  }

  insertFile(value: FileTreeNode) {
    this.nodes.set(value.id, value)
    this.root.tasks.push(value)
  }

  updateFile(file: File) {
    const value = this.nodes.get(file.id) as FileTreeNode | undefined
    if (value) {
      value.state = file.result?.state
      value.mode = file.mode
      value.duration = file.result?.duration
      value.collectDuration = file.collectDuration
      value.setupDuration = file.setupDuration
      value.environmentLoad = file.environmentLoad
      value.prepareDuration = file.prepareDuration
    }
  }

  private isAtomTest(s: Task): s is Test | Custom {
    return (s.type === 'test' || s.type === 'custom')
  }

  private createNodeTasks(parentId: string, task: Task, all = false) {
    const node = this.nodes.get(parentId) as ParentTreeNode | undefined
    let taskNode: UITaskTreeNode | undefined
    if (node) {
      taskNode = this.nodes.get(task.id) as UITaskTreeNode | undefined
      if (taskNode) {
        taskNode.mode = task.mode
        taskNode.duration = task.result?.duration
        taskNode.state = task.result?.state
      }
      else {
        if (this.isAtomTest(task)) {
          taskNode = {
            id: task.id,
            parentId,
            name: task.name,
            mode: task.mode,
            expandable: false,
            expanded: false,
            indent: node.indent + 1,
            duration: task.result?.duration,
            state: task.result?.state,
          }
        }
        else {
          taskNode = {
            id: task.id,
            parentId,
            name: task.name,
            mode: task.mode,
            expandable: true,
            expanded: false,
            tasks: [],
            indent: node.indent + 1,
            duration: task.result?.duration,
            state: task.result?.state,
          } as ParentTreeNode
        }
        this.nodes.set(task.id, taskNode)
        node.tasks.push(taskNode)
      }
      if (all && 'tasks' in task) {
        for (const subtask of task.tasks)
          this.createNodeTasks(task.id, subtask, all)
      }
    }
  }

  private expandCollapseAll(expand: boolean) {
    this.reloadTasks()
    const matcher = this.filter?.matcher
    if (matcher) {
      // collectTaskList will expand all
      const entries = this.collectTaskList()
      return expand
        ? entries
        : entries.filter((node) => {
          if (node.expandable)
            node.expanded = expand

          return 'filepath' in node
        })
    }
    else {
      for (const node of this.nodes.values()) {
        if (node.expandable)
          node.expanded = expand
      }

      return [...this.tasksList()]
    }
  }

  toggleExpand(id: string) {
    const node = this.nodes.get(id)
    if (!node || !node.expandable)
      return

    if (!node.expanded) {
      const task = client.state.idMap.get(id)
      if (!task)
        return

      this.createNodeTasks(node.id, task, false)
    }

    const suite = node as ParentTreeNode
    if (!suite.tasks.length)
      return

    // prevent expanding the node again in the task list collector
    const collapseId = node.expanded ? id : undefined
    node.expanded = !node.expanded
    uiEntries.value = this.collectTaskList(collapseId)
  }

  private *filterNodes(treeNodes: Set<string>, child: UITaskTreeNode, matcher?: TreeTaskMatcher): Generator<[child: UITaskTreeNode, match: boolean]> {
    const match = !matcher || matcher(child)

    if (match)
      treeNodes.add(child.parentId)

    yield [child, match]

    // we need to collect all nodes and expand not expanded parents
    if (this.isParentNode(child)/* && child.expanded */) {
      for (const subtask of child.tasks)
        yield * this.filterNodes(treeNodes, subtask, matcher)
    }
  }

  private *filterParents(treeNodes: Set<string>, list: [match: boolean, child: UITaskTreeNode][], collapseParents: boolean, keepCollapsedId?: string) {
    const filesToShow = new Set<string>()
    // traverse in reverse order to collect parents last
    for (let i = list.length - 1; i >= 0; i--) {
      const [match, child] = list[i]
      if (this.isParentNode(child)) {
        if (collapseParents) {
          if ('filepath' in child) {
            if (filesToShow.has(child.id)) {
              if (!child.expanded && (!keepCollapsedId || child.id !== keepCollapsedId))
                child.expanded = true

              yield child
            }

            continue
          }
          // show the parent if at least one child matches the filter
          if (treeNodes.has(child.id)) {
            if (!child.expanded && (!keepCollapsedId || child.id !== keepCollapsedId))
              child.expanded = true

            const parent = this.nodes.get(child.parentId)
            if (parent && 'filepath' in parent)
              filesToShow.add(parent.id)

            yield child
          }
        }
        else {
          // show the parent if matches the filter or at least one child matches the filter
          if (match || treeNodes.has(child.id) || filesToShow.has(child.id)) {
            if (!child.expanded && (!keepCollapsedId || child.id !== keepCollapsedId))
              child.expanded = true

            const parent = this.nodes.get(child.parentId)
            if (parent && 'filepath' in parent)
              filesToShow.add(parent.id)

            yield child
          }
        }
      }
      else if (match) {
        const parent = this.nodes.get(child.parentId)
        if (parent && 'filepath' in parent)
          filesToShow.add(parent.id)

        yield child
      }
    }
  }

  private *filterFiles(nodes: UITaskTreeNode[]) {
    const entries = [...nodes]
    for (let i = 0; i < entries.length; i++) {
      const child = entries[i]
      if ('filepath' in child) {
        const file = client.state.idMap.get(child.id)
        if (file)
          yield file as File
      }
    }
  }

  private filteredFiles(entries = uiEntries.value) {
    const files = new Set([...this.filterFiles(entries)])
    return Array.from(files)
  }

  buildNavigationEntries(expandAll: boolean, filter?: TreeTaskFilter) {
    this.filter = filter
    const entries = this.expandCollapseAll(expandAll)
    return setTimeout(() => {
      uiEntries.value = entries
      nextTick(() => {
        filteredFiles.value = this.filteredFiles()
      })
    }, 100)
  }

  private collectTaskList(keepCollapsedId?: string) {
    const matcher = this.filter?.matcher
    if (matcher) {
      const collapseParents = this.filter?.showOnlyTests === true
      const result: [match: boolean, child: UITaskTreeNode][] = []
      const treeNodes = new Set<string>()
      for (const file of this.root.tasks) {
        for (const [child, match] of this.filterNodes(treeNodes, file, matcher))
          result.push([match, child])
      }
      // the list is reversed to collect parents last: undoing the order of the generator
      return [...this.filterParents(treeNodes, result, collapseParents, keepCollapsedId)].reverse()
    }

    return [...this.tasksList()]
  }
}

const taskTree = new TaskTree()

function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  array = array || []
  if (Array.isArray(array))
    return array
  return [array]
}

function isAtomTest(s: Task): s is Test | Custom {
  return (s.type === 'test' || s.type === 'custom')
}

function getTests(suite: Arrayable<Task>): (Test | Custom)[] {
  const tests: (Test | Custom)[] = []
  const arraySuites = toArray(suite)
  for (const s of arraySuites) {
    if (isAtomTest(s)) {
      tests.push(s)
    }
    else {
      for (const task of s.tasks) {
        if (isAtomTest(task)) {
          tests.push(task)
        }
        else {
          const taskTests = getTests(task)
          for (const test of taskTests) tests.push(test)
        }
      }
    }
  }
  return tests
}

export { taskTree }
