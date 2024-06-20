import type { File, Task } from '@vitest/runner'
import { isAtomTest } from '@vitest/runner/utils'
import type { FileTreeNode, ParentTreeNode, SuiteTreeNode, UITaskTreeNode } from '~/composables/explorer/types'
import { client } from '~/composables/client'
import { getProjectNameColor, isSuite as isTaskSuite } from '~/utils/task'
import { explorerTree } from '~/composables/explorer/index'
import { openedTreeItemsSet } from '~/composables/explorer/state'

export function isTestNode(node: UITaskTreeNode): node is FileTreeNode {
  return node.type === 'test' || node.type === 'custom'
}

export function isTodoTestNodeRunning(node: UITaskTreeNode): node is FileTreeNode {
  return node.mode === 'run' && (node.type === 'test' || node.type === 'custom')
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

export function createOrUpdateFileNode(
  file: File,
  collect = false,
) {
  let fileNode = explorerTree.nodes.get(file.id) as FileTreeNode | undefined

  if (fileNode) {
    // if (explorerTree.isUITaskDone(fileNode)) {
    //   return
    // }

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
    explorerTree.nodes.set(file.id, fileNode)
    explorerTree.root.tasks.push(fileNode)
  }
  if (collect) {
    for (let i = 0; i < file.tasks.length; i++) {
      createOrUpdateNode(file.id, file.tasks[i], true)
    }
  }

  // if (isTaskDone(file)) {
  //   explorerTree.taskDone(fileNode.id)
  // }
}

export function createOrUpdateSuiteTask(
  id: string,
  all: boolean,
) {
  const node = explorerTree.nodes.get(id)
  if (!node || !isParentNode(node)/* || explorerTree.isUITaskDone(node) */) {
    return
  }

  const task = client.state.idMap.get(id)
  // if no children just return
  if (!task || !isTaskSuite(task)) {
    return
  }

  // update the node
  createOrUpdateNode(node.parentId, task, all && task.tasks.length > 0)

  // if (isTaskDone(task)) {
  //   explorerTree.taskDone(task.id)
  // }

  return [node, task] as const
}

export function createOrUpdateNodeTask(id: string) {
  const node = explorerTree.nodes.get(id)
  if (!node/* || explorerTree.isUITaskDone(node) */) {
    return
  }

  const task = client.state.idMap.get(id)
  // if no children just return
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
  if (node) {
    taskNode = explorerTree.nodes.get(task.id)
    if (taskNode) {
      if (!node.children.has(task.id)) {
        node.tasks.push(taskNode)
        node.children.add(task.id)
      }
      /* if (explorerTree.isUITaskDone(taskNode)) {
        return
      } */

      taskNode.mode = task.mode
      taskNode.duration = task.result?.duration
      taskNode.state = task.result?.state
      if (isSuiteNode(taskNode)) {
        taskNode.typecheck = !!task.meta && 'typecheck' in task.meta
      }
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
          typecheck: !!task.meta && 'typecheck' in task.meta,
          type: 'suite',
          expandable: true,
          // When the current run finish, we will expand all nodes when required, here we expand only the opened nodes
          expanded: openedTreeItemsSet.value.size > 0 && openedTreeItemsSet.value.has(task.id),
          children: new Set(),
          tasks: [],
          indent: node.indent + 1,
          duration: task.result?.duration,
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

    /* if (isTaskDone(task)) {
      explorerTree.taskDone(task.id)
    } */
  }
}
