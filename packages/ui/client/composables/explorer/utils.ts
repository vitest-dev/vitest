import type { File, Task } from '@vitest/runner'
import { isAtomTest } from '@vitest/runner/utils'
import type { FileTreeNode, ParentTreeNode, SuiteTreeNode, UITaskTreeNode } from '~/composables/explorer/types'
import { client } from '~/composables/client'
import { getProjectNameColor, isSuite as isTaskSuite } from '~/utils/task'

export function isFileNode(node: UITaskTreeNode): node is FileTreeNode {
  return node.type === 'file'
}
export function isSuiteNode(node: UITaskTreeNode): node is SuiteTreeNode {
  return node.type === 'suite'
}

export function isParentNode(node: UITaskTreeNode): node is FileTreeNode | SuiteTreeNode {
  return node.type === 'file' || node.type === 'suite'
}

export function createOrUpdateFileNode(
  file: File,
  nodes: Map<string, UITaskTreeNode>,
  rootTasks: FileTreeNode[],
  collect = false,
) {
  let fileNode = nodes.get(file.id) as FileTreeNode | undefined

  if (fileNode) {
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
      expanded: false,
      type: 'file',
      tasks: [],
      indent: 0,
      duration: file.result?.duration,
      filepath: file.filepath,
      projectName: file.projectName || '',
      projectNameColor: getProjectNameColor(file.projectName),
      collectDuration: file.collectDuration,
      setupDuration: file.setupDuration,
      environmentLoad: file.environmentLoad,
      prepareDuration: file.prepareDuration,
      state: file.result?.state,
    }
    nodes.set(file.id, fileNode)
    rootTasks.push(fileNode)
  }
  if (collect) {
    for (let i = 0; i < file.tasks.length; i++)
      createOrUpdateNode(file.id, file.tasks[i], nodes, true)
  }
}

export function createOrUpdateSuiteTask(
  id: string,
  nodes: Map<string, UITaskTreeNode>,
  all: boolean,
) {
  const node = nodes.get(id)
  if (!node || !isParentNode(node))
    return

  const task = client.state.idMap.get(id)
  // if no children just return
  if (!task || !isTaskSuite(task))
    return

  // update the node
  createOrUpdateNode(node.parentId, task, nodes, all && task.tasks.length > 0)

  return [node, task] as const
}

export function createOrUpdateNodeTask(
  id: string,
  nodes: Map<string, UITaskTreeNode>,
) {
  const node = nodes.get(id)
  if (!node)
    return

  const task = client.state.idMap.get(id)
  // if no children just return
  if (!task || !isAtomTest(task))
    return

  createOrUpdateNode(node.parentId, task, nodes, false)
}

export function createOrUpdateNode(
  parentId: string,
  task: Task,
  nodes: Map<string, UITaskTreeNode>,
  createAll: boolean,
) {
  const node = nodes.get(parentId) as ParentTreeNode | undefined
  let taskNode: UITaskTreeNode | undefined
  if (node) {
    taskNode = nodes.get(task.id) as UITaskTreeNode | undefined
    if (taskNode) {
      taskNode.mode = task.mode
      taskNode.duration = task.result?.duration
      taskNode.state = task.result?.state
      if (isSuiteNode(taskNode))
        taskNode.typecheck = task.meta?.typecheck
    }
    else {
      if (isAtomTest(task)) {
        taskNode = {
          id: task.id,
          parentId,
          name: task.name,
          mode: task.mode,
          type: task.type,
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
          typecheck: task.meta?.typecheck,
          type: 'suite',
          expandable: true,
          expanded: false,
          tasks: [],
          indent: node.indent + 1,
          duration: task.result?.duration,
          state: task.result?.state,
        } as SuiteTreeNode
      }
      nodes.set(task.id, taskNode)
      node.tasks.push(taskNode)
    }
    if (createAll && isTaskSuite(task)) {
      for (let i = 0; i < task.tasks.length; i++)
        createOrUpdateNode(task.id, task.tasks[i], nodes, createAll)
    }
  }
}
