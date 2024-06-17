import type { Task } from '@vitest/runner'
import { caseInsensitiveMatch } from '~/utils/task'
import type { FileTreeNode, Filter, FilterResult, ParentTreeNode, UITaskTreeNode } from '~/composables/explorer/types'
import {
  isFileNode,
  isParentNode,
} from '~/composables/explorer/utils'
import { client, findById } from '~/composables/client'
import { filteredFiles, uiEntries } from '~/composables/explorer/state'

export function testMatcher(task: Task, search: string, filter: Filter) {
  return task ? matchTask(task, search, filter) : false
}
/**
 * Filter child nodes using search, filter and only tests.
 *
 * @param nodes The file nodes.
 * @param nodeTree Tree node map.
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runFilter(
  nodes: FileTreeNode[],
  nodeTree: Map<string, UITaskTreeNode>,
  search: string,
  filter: Filter,
) {
  const entries = [...filterAll(
    nodes,
    nodeTree,
    search,
    filter,
  )]
  uiEntries.value = entries
  filteredFiles.value = entries.filter(isFileNode).map(f => findById(f.id)!)
}

export function* filterAll(
  nodes: UITaskTreeNode[],
  nodeTree: Map<string, UITaskTreeNode>,
  search: string,
  filter: Filter,
) {
  for (const node of nodes) {
    yield * filterTask(node, nodeTree, search, filter)
  }
}

export function* filterTask(
  node: UITaskTreeNode,
  nodes: Map<string, UITaskTreeNode>,
  search: string,
  filter: Filter,
) {
  const treeNodes = new Set<string>()

  const list: FilterResult[] = []

  for (const entry of visitNode(
    node,
    nodes,
    treeNodes,
    n => matcher(n, search, filter),
  )) { list.push(entry) }

  const filesToShow = new Set<string>()

  const entries = [...filterParents(
    list,
    nodes,
    filter.onlyTests,
    treeNodes,
    filesToShow,
  )].reverse()

  // we need to remove any child added when filtering: we traverse the full tree
  const parents = new Set(
    entries.filter(e => isParentNode(e) && e.expanded).map(e => e.id),
  )
  yield * entries.filter((node) => {
    // all file nodes, or expanded parents, or children of expanded parents
    return isFileNode(node) || (isParentNode(node) ? node.expanded : parents.has(node.parentId))
  })
}

function expandCollapseNode(
  match: boolean,
  child: FileTreeNode | ParentTreeNode,
  treeNodes: Set<string>,
  collapseParents: boolean,
  filesToShow: Set<string>,
  nodes: Map<string, UITaskTreeNode>,
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
      const parent = nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }

      return child
    }
  }
  else {
    // show the parent if matches the filter or at least one child matches the filter
    if (match || treeNodes.has(child.id) || filesToShow.has(child.id)) {
      const parent = nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }

      return child
    }
  }
}

function* filterParents(
  list: FilterResult[],
  nodes: Map<string, UITaskTreeNode>,
  collapseParents: boolean,
  treeNodes: Set<string>,
  filesToShow: Set<string>,
) {
  for (let i = list.length - 1; i >= 0; i--) {
    const [match, child] = list[i]
    if (isParentNode(child)) {
      const node = expandCollapseNode(
        match,
        child,
        treeNodes,
        collapseParents,
        filesToShow,
        nodes,
      )
      if (node) {
        yield node
      }
    }
    else if (match) {
      const parent = nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }

      yield child
    }
  }
}

function matchState(task: Task, filter: Filter) {
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
  search: string,
  filter: Filter,
) {
  const match = search.length === 0 || caseInsensitiveMatch(task.name, search)

  // search and filter will apply together
  if (match) {
    if (filter.success || filter.failed || filter.skipped) {
      if (matchState(task, filter)) {
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
  node: UITaskTreeNode,
  nodes: Map<string, UITaskTreeNode>,
  treeNodes: Set<string>,
  matcher: (node: UITaskTreeNode) => boolean,
): Generator<[match: boolean, node: UITaskTreeNode]> {
  const match = matcher(node)

  if (match) {
    treeNodes.add(node.parentId)
  }

  yield [match, node]
  if (isParentNode(node)) {
    for (let i = 0; i < node.tasks.length; i++) {
      yield * visitNode(node.tasks[i], nodes, treeNodes, matcher)
    }
  }
}

function matcher(node: UITaskTreeNode, search: string, filter: Filter) {
  const task = client.state.idMap.get(node.id)
  return task ? matchTask(task, search, filter) : false
}
