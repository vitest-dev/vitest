import type { RunnerTask as Task } from 'vitest'
import type { Filter, SearchMatcher, UITaskTreeNode } from '~/composables/explorer/types'
import { client, config, findById } from '~/composables/client'
import { explorerTree } from '~/composables/explorer/index'
import {
  currentProjectName,
  filteredFiles,
  projectSort,
  uiEntries,
} from '~/composables/explorer/state'
import { getSortedRootTasks, isFileNode, isParentNode } from '~/composables/explorer/utils'

interface FilterNodeContext {
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
): boolean {
  return matchTask(task, search, filter, slowTestThreshold)
}

/**
 * Rebuild the explorer rows for the whole tree and publish them to `uiEntries` and `filteredFiles`.
 */
export function runFilter(search: SearchMatcher, filter: Filter): void {
  const entries = filterAll(search, filter)
  uiEntries.value = entries
  filteredFiles.value = entries.filter(isFileNode).map((f) => findById(f.id)!)
}

/**
 * Return the explorer rows for every file of the current project, in sort order.
 *
 * Reads the current project, sort order, explorer tree, task state, and config. Kept parents are marked
 * expanded, and nothing else is written.
 */
export function filterAll(search: SearchMatcher, filter: Filter): UITaskTreeNode[] {
  const project = currentProjectName.value
  const tasks = getSortedRootTasks(explorerTree.root.tasks, projectSort.value)
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

/**
 * Return the rows the full filter shows for `node` and its subtree: `node` first, then its visible
 * descendants in tree order, or nothing when `node` does not pass the filter.
 *
 * `node` can be anywhere in the tree, because matches inherited from its ancestors are checked too.
 */
export function filterNode(node: UITaskTreeNode, context: FilterNodeContext): UITaskTreeNode[] {
  const filteredTree = filterTreeNode(node, context, hasMatchingAncestor(node, context))
  return filteredTree ? flattenVisibleTree(filteredTree) : []
}

/**
 * Return the kept part of the subtree under `node`, or `undefined` when `node` is not kept.
 *
 * A node is kept when an ancestor matched (`ancestorMatches`) or when the node or one of its descendants
 * matched (`subtreeMatches`). Kept parents are marked expanded.
 */
function filterTreeNode(
  node: UITaskTreeNode,
  context: FilterNodeContext,
  ancestorMatches: boolean,
): FilteredTreeNode | undefined {
  const nodeMatches = matchesNode(node, context)
  const descendantsInheritMatch = ancestorMatches || nodeMatches
  const children = isParentNode(node)
    ? node.tasks
        .map((child) => filterTreeNode(child, context, descendantsInheritMatch))
        .filter((child) => child !== undefined)
    : []
  const subtreeMatches = nodeMatches || children.some((child) => child.subtreeMatches)

  if (!ancestorMatches && !subtreeMatches) {
    return undefined
  }

  if (isParentNode(node)) {
    node.expanded = true
  }

  return {
    node,
    children,
    subtreeMatches,
  }
}

function hasMatchingAncestor(node: UITaskTreeNode, context: FilterNodeContext): boolean {
  let parent = context.nodes.get(node.parentId)
  while (parent) {
    if (matchesNode(parent, context)) {
      return true
    }
    parent = context.nodes.get(parent.parentId)
  }
  return false
}

function matchesNode(node: UITaskTreeNode, context: FilterNodeContext): boolean {
  if (context.filter.onlyTests && node.type !== 'test') {
    return false
  }
  const task = context.tasks.get(node.id)
  return task ? matchTask(task, context.search, context.filter, context.slowTestThreshold) : false
}

function flattenVisibleTree(
  tree: FilteredTreeNode,
  entries: UITaskTreeNode[] = [],
): UITaskTreeNode[] {
  entries.push(tree.node)
  if (!isParentNode(tree.node) || !tree.node.expanded) {
    return entries
  }
  for (const child of tree.children) {
    flattenVisibleTree(child, entries)
  }

  return entries
}

function matchState(task: Task, filter: Filter, slowTestThreshold: number | undefined): boolean {
  if (filter.slow) {
    if (task.type === 'test') {
      if (
        typeof slowTestThreshold === 'number' &&
        typeof task.result?.duration === 'number' &&
        task.result.duration > slowTestThreshold
      ) {
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
): boolean {
  // search and filter will apply together
  if (search(task)) {
    const hasStatusFilter = filter.success || filter.failed || filter.skipped || filter.slow
    if (hasStatusFilter) {
      if (matchState(task, filter, slowTestThreshold)) {
        return true
      }
    } else {
      return true
    }
  }

  return false
}
