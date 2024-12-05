import type { File, Task } from '@vitest/runner'
import type {
  FileTreeNode,
  ParentTreeNode,
  SuiteTreeNode,
  TestTreeNode,
  UITaskTreeNode,
} from '~/composables/explorer/types'
import { isAtomTest } from '@vitest/runner/utils'
import { client } from '~/composables/client'
import { explorerTree } from '~/composables/explorer/index'
import { openedTreeItemsSet } from '~/composables/explorer/state'
import { getProjectNameColor, isSuite as isTaskSuite } from '~/utils/task'

export function isTestNode(node: UITaskTreeNode): node is TestTreeNode {
  return node.type === 'test'
}

export function isRunningTestNode(node: UITaskTreeNode): node is TestTreeNode {
  return node.mode === 'run' && (node.type === 'test')
}

export function isFileNode(node: UITaskTreeNode): node is FileTreeNode {
  return node.type === 'file'
}

export function isSuiteNode(node: UITaskTreeNode): node is SuiteTreeNode {
  return node.type === 'suite'
}

export function isParentNode(node: UITaskTreeNode): node is FileTreeNode | SuiteTreeNode {
  return node.type === 'file' || node.type === 'suite'
}

export function sortedRootTasks(tasks = explorerTree.root.tasks) {
  return tasks.sort((a, b) => {
    return `${a.filepath}:${a.projectName}`.localeCompare(`${b.filepath}:${b.projectName}`)
  })
}

export function createOrUpdateFileNode(
  file: File,
  collect = false,
) {
  let fileNode = explorerTree.nodes.get(file.id) as FileTreeNode | undefined

  if (fileNode) {
    fileNode.typecheck = !!file.meta && 'typecheck' in file.meta
    fileNode.state = file.result?.state
    fileNode.mode = file.mode
    fileNode.duration = file.result?.duration
    fileNode.collectDuration = file.collectDuration
    fileNode.setupDuration = file.setupDuration
    fileNode.environmentLoad = file.environmentLoad
    fileNode.prepareDuration = file.prepareDuration
  }
  else {
    fileNode = {
      id: file.id,
      parentId: 'root',
      name: file.name,
      mode: file.mode,
      expandable: true,
      // When the current run finish, we will expand all nodes when required, here we expand only the opened nodes
      expanded: openedTreeItemsSet.value.size > 0 && openedTreeItemsSet.value.has(file.id),
      type: 'file',
      children: new Set(),
      tasks: [],
      typecheck: !!file.meta && 'typecheck' in file.meta,
      indent: 0,
      duration: file.result?.duration != null ? Math.round(file.result?.duration) : undefined,
      filepath: file.filepath,
      projectName: file.projectName || '',
      projectNameColor: getProjectNameColor(file.projectName),
      collectDuration: file.collectDuration,
      setupDuration: file.setupDuration,
      environmentLoad: file.environmentLoad,
      prepareDuration: file.prepareDuration,
      state: file.result?.state,
    }
    explorerTree.nodes.set(file.id, fileNode)
    explorerTree.root.tasks.push(fileNode)
  }
  if (collect) {
    for (let i = 0; i < file.tasks.length; i++) {
      createOrUpdateNode(file.id, file.tasks[i], true)
    }
  }
}

export function createOrUpdateSuiteTask(
  id: string,
  all: boolean,
) {
  const node = explorerTree.nodes.get(id)
  if (!node || !isParentNode(node)) {
    return
  }

  const task = client.state.idMap.get(id)
  // if no children just return
  if (!task || !isTaskSuite(task)) {
    return
  }

  // update the node
  createOrUpdateNode(node.parentId, task, all && task.tasks.length > 0)

  return [node, task] as const
}

export function createOrUpdateNodeTask(id: string) {
  const node = explorerTree.nodes.get(id)
  if (!node) {
    return
  }

  const task = client.state.idMap.get(id)
  // if it is not a test just return
  if (!task || !isAtomTest(task)) {
    return
  }

  createOrUpdateNode(node.parentId, task, false)
}

export function createOrUpdateNode(
  parentId: string,
  task: Task,
  createAll: boolean,
) {
  const node = explorerTree.nodes.get(parentId) as ParentTreeNode | undefined
  let taskNode: UITaskTreeNode | undefined
  const duration = task.result?.duration != null
    ? Math.round(task.result?.duration)
    : undefined
  if (node) {
    taskNode = explorerTree.nodes.get(task.id)
    if (taskNode) {
      if (!node.children.has(task.id)) {
        node.tasks.push(taskNode)
        node.children.add(task.id)
      }

      taskNode.mode = task.mode
      taskNode.duration = duration
      taskNode.state = task.result?.state
    }
    else {
      if (isAtomTest(task)) {
        taskNode = {
          id: task.id,
          fileId: task.file.id,
          parentId,
          name: task.name,
          mode: task.mode,
          type: task.type,
          expandable: false,
          expanded: false,
          indent: node.indent + 1,
          duration,
          state: task.result?.state,
        } as TestTreeNode
      }
      else {
        taskNode = {
          id: task.id,
          fileId: task.file.id,
          parentId,
          name: task.name,
          mode: task.mode,
          type: 'suite',
          expandable: true,
          // When the current run finish, we will expand all nodes when required, here we expand only the opened nodes
          expanded: openedTreeItemsSet.value.size > 0 && openedTreeItemsSet.value.has(task.id),
          children: new Set(),
          tasks: [],
          indent: node.indent + 1,
          duration,
          state: task.result?.state,
        } as SuiteTreeNode
      }
      explorerTree.nodes.set(task.id, taskNode)
      node.tasks.push(taskNode)
      node.children.add(task.id)
    }

    if (taskNode && createAll && isTaskSuite(task)) {
      for (let i = 0; i < task.tasks.length; i++) {
        createOrUpdateNode(taskNode.id, task.tasks[i], createAll)
      }
    }
  }
}
