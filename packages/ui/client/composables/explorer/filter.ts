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

export function testMatcher(task: Task, search: SearchMatcher, filter: Filter) {
  return task ? matchTask(task, search, filter, config.value.slowTestThreshold) : false
}

interface FilterNodeContext {
  nodes: ReadonlyMap<string, UITaskTreeNode>
  matches: (node: UITaskTreeNode) => boolean
}

interface FilteredTreeNode {
  node: UITaskTreeNode
  children: FilteredTreeNode[]
  subtreeMatches: boolean
}

export function createFilterNodeContext(
  search: SearchMatcher,
  filter: Filter,
): FilterNodeContext {
  const slowTestThreshold = config.value.slowTestThreshold
  return {
    nodes: explorerTree.nodes,
    matches(node) {
      const task = client.state.idMap.get(node.id)
      return task ? matchTask(task, search, filter, slowTestThreshold) : false
    },
  }
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
  const entries = [...filterAll(
    search,
    filter,
  )]
  uiEntries.value = entries
  filteredFiles.value = entries.filter(isFileNode).map(f => findById(f.id)!)
}

export function* filterAll(
  search: SearchMatcher,
  filter: Filter,
) {
  const project = currentProjectName.value
  const tasks = getSortedRootTasks(projectSort.value)
  const context = createFilterNodeContext(search, filter)

  for (const node of tasks) {
    if (project && node.projectName !== project) {
      continue
    }
    yield* filterNode(node, filter.onlyTests, context)
  }
}

export function* filterNode(
  node: UITaskTreeNode,
  onlyTests: boolean,
  context: FilterNodeContext,
) {
  const file = isFileNode(node)
    ? undefined
    : 'fileId' in node
      ? context.nodes.get(node.fileId as string)
      : undefined
  const ancestorMatches = !onlyTests && !!file && context.matches(file)
  const filteredTree = filterTreeNode(node, onlyTests, context, ancestorMatches)
  if (filteredTree) {
    yield* flattenVisibleTree(filteredTree, isFileNode(node))
  }
}

function filterTreeNode(
  node: UITaskTreeNode,
  onlyTests: boolean,
  context: FilterNodeContext,
  ancestorMatches: boolean,
): FilteredTreeNode | undefined {
  const nodeMatches = (!onlyTests || node.type === 'test') && context.matches(node)
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

function* flattenVisibleTree(
  tree: FilteredTreeNode,
  includeRoot: boolean,
): Generator<UITaskTreeNode> {
  if (includeRoot) {
    yield tree.node
  }
  if (!isParentNode(tree.node) || !tree.node.expanded) {
    return
  }
  for (const child of tree.children) {
    yield* flattenVisibleTree(child, true)
  }
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
