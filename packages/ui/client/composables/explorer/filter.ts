import type { RunnerTask as Task } from 'vitest'
import type { Filter, SearchMatcher, UITaskTreeNode } from '~/composables/explorer/types'
import { client, config, findById } from '~/composables/client'
import { explorerTree } from '~/composables/explorer/index'
import { currentProjectName, filteredFiles, projectSort, uiEntries } from '~/composables/explorer/state'
import {
  getSortedRootTasks,
  isFileNode,
  isParentNode,
} from '~/composables/explorer/utils'

export interface FilterNodeContext {
  nodes: ReadonlyMap<string, UITaskTreeNode>
  tasks: ReadonlyMap<string, Task>
  search: SearchMatcher
  filter: Filter
  slowTestThreshold: number | undefined
}

interface FilteredTreeNode {
  node: UITaskTreeNode
  children: FilteredTreeNode[]
  subtreeMatches: boolean
}

export function testMatcher(
  task: Task,
  search: SearchMatcher,
  filter: Filter,
  slowTestThreshold: number | undefined,
) {
  return matchTask(task, search, filter, slowTestThreshold)
}

/**
 * Filter child nodes using search, filter and only tests.
 *
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runFilter(
  search: SearchMatcher,
  filter: Filter,
) {
  const entries = filterAll(
    search,
    filter,
  )
  uiEntries.value = entries
  filteredFiles.value = entries.filter(isFileNode).map(f => findById(f.id)!)
}

export function filterAll(
  search: SearchMatcher,
  filter: Filter,
) {
  const project = currentProjectName.value
  const tasks = getSortedRootTasks(projectSort.value)
  const entries: UITaskTreeNode[] = []
  const context: FilterNodeContext = {
    nodes: explorerTree.nodes,
    tasks: client.state.idMap,
    search,
    filter,
    slowTestThreshold: config.value.slowTestThreshold,
  }

  for (const node of tasks) {
    if (project && node.projectName !== project) {
      continue
    }
    for (const entry of filterNode(node, context)) {
      entries.push(entry)
    }
  }

  return entries
}

export function filterNode(
  node: UITaskTreeNode,
  context: FilterNodeContext,
) {
  const { onlyTests } = context.filter
  const file = isFileNode(node)
    ? undefined
    : 'fileId' in node
      ? context.nodes.get(node.fileId as string)
      : undefined
  const ancestorMatches = !onlyTests && !!file && matchesNode(file, context)
  const filteredTree = filterTreeNode(node, onlyTests, context, ancestorMatches)
  return filteredTree
    ? flattenVisibleTree(filteredTree, isFileNode(node))
    : []
}

function filterTreeNode(
  node: UITaskTreeNode,
  onlyTests: boolean,
  context: FilterNodeContext,
  ancestorMatches: boolean,
): FilteredTreeNode | undefined {
  const nodeMatches = (!onlyTests || node.type === 'test') && matchesNode(node, context)
  const descendantsInheritMatch = ancestorMatches || nodeMatches
  const children = isParentNode(node)
    ? node.tasks
        .map(child => filterTreeNode(
          child,
          onlyTests,
          context,
          descendantsInheritMatch,
        ))
        .filter(child => child !== undefined)
    : []
  const subtreeMatches = nodeMatches || children.some(child => child.subtreeMatches)

  if (!ancestorMatches && !subtreeMatches) {
    return undefined
  }

  if (isParentNode(node) && (ancestorMatches || subtreeMatches)) {
    node.expanded = true
  }

  return {
    node,
    children,
    subtreeMatches,
  }
}

function matchesNode(node: UITaskTreeNode, context: FilterNodeContext) {
  const task = context.tasks.get(node.id)
  return task
    ? matchTask(task, context.search, context.filter, context.slowTestThreshold)
    : false
}

function flattenVisibleTree(
  tree: FilteredTreeNode,
  includeRoot: boolean,
  entries: UITaskTreeNode[] = [],
) {
  if (includeRoot) {
    entries.push(tree.node)
  }
  if (!isParentNode(tree.node) || !tree.node.expanded) {
    return entries
  }
  for (const child of tree.children) {
    flattenVisibleTree(child, true, entries)
  }

  return entries
}

function matchState(task: Task, filter: Filter, slowTestThreshold: number | undefined) {
  if (filter.slow) {
    if (task.type === 'test') {
      if (typeof slowTestThreshold === 'number' && typeof task.result?.duration === 'number' && task.result.duration > slowTestThreshold) {
        return true
      }
    }
  }

  if (filter.success || filter.failed) {
    if ('result' in task) {
      if (filter.success && task.result?.state === 'pass') {
        return true
      }
      if (filter.failed && task.result?.state === 'fail') {
        return true
      }
    }
  }

  if (filter.skipped && 'mode' in task) {
    return task.mode === 'skip' || task.mode === 'todo'
  }

  return false
}

function matchTask(
  task: Task,
  search: SearchMatcher,
  filter: Filter,
  slowTestThreshold: number | undefined,
) {
  // search and filter will apply together
  if (search(task)) {
    const hasStatusFilter = filter.success || filter.failed || filter.skipped || filter.slow
    if (hasStatusFilter) {
      if (matchState(task, filter, slowTestThreshold)) {
        return true
      }
    }
    else {
      return true
    }
  }

  return false
}
