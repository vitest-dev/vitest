import type { RunnerTask as Task } from 'vitest'
import type { ExplorerOperationContext, FileTreeNode, Filter, FilterResult, ParentTreeNode, SearchMatcher, UITaskTreeNode } from '~/composables/explorer/types'
import { currentProjectName, filteredFiles, projectSort, uiEntries } from '~/composables/explorer/state'
import {
  getSortedRootTasks,
  isFileNode,
  isParentNode,
  isTestNode,
} from '~/composables/explorer/utils'

export function testMatcher(context: ExplorerOperationContext, task: Task, search: SearchMatcher, filter: Filter) {
  return task ? matchTask(context, task, search, filter) : false
}
/**
 * Filter child nodes using search, filter and only tests.
 *
 * @param context The explorer operation context.
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runFilter(
  context: ExplorerOperationContext,
  search: SearchMatcher,
  filter: Filter,
) {
  const entries = [...filterAll(
    context,
    search,
    filter,
  )]
  uiEntries.value = entries
  filteredFiles.value = entries.filter(isFileNode).map(f => context.dataSource.getFile(f.id)!)
}

export function* filterAll(
  context: ExplorerOperationContext,
  search: SearchMatcher,
  filter: Filter,
) {
  const project = currentProjectName.value
  const tasks = getSortedRootTasks(projectSort.value, context.root.tasks)

  for (const node of tasks) {
    if (project && node.projectName !== project) {
      continue
    }
    yield* filterNode(context, node, search, filter)
  }
}

export function* filterNode(
  context: ExplorerOperationContext,
  node: UITaskTreeNode,
  search: SearchMatcher,
  filter: Filter,
) {
  const treeNodes = new Set<string>()

  const parentsMap = new Map<string, boolean>()
  const list: FilterResult[] = []

  let fileId: string | undefined

  if (filter.onlyTests) {
    for (const [match, child] of visitNode(
      context,
      node,
      treeNodes,
      n => matcher(context, n, search, filter),
    )) {
      list.push([match, child])
    }
  }
  else {
    for (const [match, child] of visitNode(
      context,
      node,
      treeNodes,
      n => matcher(context, n, search, filter),
    )) {
      if (isParentNode(child)) {
        parentsMap.set(child.id, match)
        if (isFileNode(child)) {
          if (match) {
            fileId = child.id
          }
          list.push([match, child])
        }
        else {
          list.push([match || parentsMap.get(child.parentId) === true, child])
        }
      }
      else {
        list.push([match || parentsMap.get(child.parentId) === true, child])
      }
    }
    // when expanding a non-file node
    if (!fileId && !isFileNode(node) && 'fileId' in node) {
      fileId = node.fileId as string
    }
  }

  const filesToShow = new Set<string>()

  const entries = [...filterParents(
    context,
    list,
    filter.onlyTests,
    treeNodes,
    filesToShow,
    fileId,
  )].reverse()

  // We show only the files and parents whose parent is expanded.
  // Filtering will return all the nodes matching the filter and their parents.
  // Once we've the tree, we need to remove the children from not expanded parents.
  // For example, if we have a suite with only one test, when collapsing the suite node,
  // we still need to show the suite, but the test must be removed from the list to render.

  const map = context.nodes

  // When searching, expand parent nodes of matching tests so they are visible
  for (const id of treeNodes) {
    const treeNode = map.get(id)
    if (treeNode && 'expanded' in treeNode) {
      treeNode.expanded = true
    }
  }

  // collect files and all suites whose parent is expanded
  const parents = new Set(
    entries.filter(e => isFileNode(e) || (isParentNode(e) && map.get(e.parentId)?.expanded)).map(e => e.id),
  )

  // collect files, and suites and tests whose parent is expanded
  yield* entries.filter((node) => {
    // all file nodes or children of expanded parents
    return isFileNode(node) || (parents.has(node.parentId) && map.get(node.parentId)?.expanded)
  })
}

function expandCollapseNode(
  context: ExplorerOperationContext,
  match: boolean,
  child: FileTreeNode | ParentTreeNode,
  treeNodes: Set<string>,
  collapseParents: boolean,
  filesToShow: Set<string>,
) {
  if (collapseParents) {
    if (isFileNode(child)) {
      if (filesToShow.has(child.id)) {
        return child
      }

      return undefined
    }
    // show the parent if at least one child matches the filter
    if (treeNodes.has(child.id)) {
      const parent = context.nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }

      return child
    }
  }
  else {
    // show the parent if matches the filter or at least one child matches the filter
    if (match || treeNodes.has(child.id) || filesToShow.has(child.id)) {
      const parent = context.nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }

      return child
    }
  }
}

function* filterParents(
  context: ExplorerOperationContext,
  list: FilterResult[],
  collapseParents: boolean,
  treeNodes: Set<string>,
  filesToShow: Set<string>,
  nodeId?: string,
) {
  for (let i = list.length - 1; i >= 0; i--) {
    const [match, child] = list[i]
    const isParent = isParentNode(child)
    if (!collapseParents && nodeId && treeNodes.has(nodeId) && 'fileId' in child && child.fileId === nodeId) {
      if (isParent) {
        treeNodes.add(child.id)
      }
      let parent = context.nodes.get(child.parentId)
      while (parent) {
        treeNodes.add(parent.id)
        if (isFileNode(parent)) {
          filesToShow.add(parent.id)
        }
        parent = context.nodes.get(parent.parentId)
      }
      yield child
      continue
    }

    if (isParent) {
      const node = expandCollapseNode(
        context,
        match,
        child,
        treeNodes,
        collapseParents,
        filesToShow,
      )
      if (node) {
        yield node
      }
    }
    else if (match) {
      const parent = context.nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }
      yield child
    }
  }
}

function matchState(context: ExplorerOperationContext, task: Task, filter: Filter) {
  if (filter.slow) {
    if (task.type === 'test') {
      const threshold = context.dataSource.getSlowTestThreshold()
      if (typeof threshold === 'number' && typeof task.result?.duration === 'number' && task.result.duration > threshold) {
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
  context: ExplorerOperationContext,
  task: Task,
  search: SearchMatcher,
  filter: Filter,
) {
  // search and filter will apply together
  if (search(task)) {
    const hasStatusFilter = filter.success || filter.failed || filter.skipped || filter.slow
    if (hasStatusFilter) {
      if (matchState(context, task, filter)) {
        return true
      }
    }
    else {
      return true
    }
  }

  return false
}

function* visitNode(
  context: ExplorerOperationContext,
  node: UITaskTreeNode,
  treeNodes: Set<string>,
  matcher: (node: UITaskTreeNode) => boolean,
): Generator<[match: boolean, node: UITaskTreeNode]> {
  const match = matcher(node)

  if (match) {
    if (isTestNode(node)) {
      let parent = context.nodes.get(node.parentId)
      while (parent) {
        treeNodes.add(parent.id)
        parent = context.nodes.get(parent.parentId)
      }
    }
    else if (isFileNode(node)) {
      treeNodes.add(node.id)
    }
    else {
      treeNodes.add(node.id)
      let parent = context.nodes.get(node.parentId)
      while (parent) {
        treeNodes.add(parent.id)
        parent = context.nodes.get(parent.parentId)
      }
    }
  }

  yield [match, node]
  if (isParentNode(node)) {
    for (let i = 0; i < node.tasks.length; i++) {
      yield* visitNode(context, node.tasks[i], treeNodes, matcher)
    }
  }
}

function matcher(context: ExplorerOperationContext, node: UITaskTreeNode, search: SearchMatcher, filter: Filter) {
  const task = context.dataSource.getTask(node.id)
  return task ? matchTask(context, task, search, filter) : false
}
