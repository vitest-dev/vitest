import type { Task } from '@vitest/runner'
import type { FileTreeNode, Filter, FilterResult, ParentTreeNode, UITaskTreeNode } from '~/composables/explorer/types'
import { client, findById } from '~/composables/client'
import { explorerTree } from '~/composables/explorer/index'
import { filteredFiles, uiEntries } from '~/composables/explorer/state'
import {
  isFileNode,
  isParentNode,
  isTestNode,
  sortedRootTasks,
} from '~/composables/explorer/utils'
import { caseInsensitiveMatch } from '~/utils/task'

export function testMatcher(task: Task, search: string, filter: Filter) {
  return task ? matchTask(task, search, filter) : false
}
/**
 * Filter child nodes using search, filter and only tests.
 *
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runFilter(
  search: string,
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
  search: string,
  filter: Filter,
) {
  for (const node of sortedRootTasks()) {
    yield * filterNode(node, search, filter)
  }
}

export function* filterNode(
  node: UITaskTreeNode,
  search: string,
  filter: Filter,
) {
  const treeNodes = new Set<string>()

  const parentsMap = new Map<string, boolean>()
  const list: FilterResult[] = []

  let fileId: string | undefined

  if (filter.onlyTests) {
    for (const [match, child] of visitNode(
      node,
      treeNodes,
      n => matcher(n, search, filter),
    )) {
      list.push([match, child])
    }
  }
  else {
    for (const [match, child] of visitNode(
      node,
      treeNodes,
      n => matcher(n, search, filter),
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

  const map = explorerTree.nodes
  // collect files and all suites whose parent is expanded
  const parents = new Set(
    entries.filter(e => isFileNode(e) || (isParentNode(e) && map.get(e.parentId)?.expanded)).map(e => e.id),
  )

  // collect files, and suites and tests whose parent is expanded
  yield * entries.filter((node) => {
    // all file nodes or children of expanded parents
    return isFileNode(node) || (parents.has(node.parentId) && map.get(node.parentId)?.expanded)
  })
}

function expandCollapseNode(
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
      const parent = explorerTree.nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }

      return child
    }
  }
  else {
    // show the parent if matches the filter or at least one child matches the filter
    if (match || treeNodes.has(child.id) || filesToShow.has(child.id)) {
      const parent = explorerTree.nodes.get(child.parentId)
      if (parent && isFileNode(parent)) {
        filesToShow.add(parent.id)
      }

      return child
    }
  }
}

function* filterParents(
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
      let parent = explorerTree.nodes.get(child.parentId)
      while (parent) {
        treeNodes.add(parent.id)
        if (isFileNode(parent)) {
          filesToShow.add(parent.id)
        }
        parent = explorerTree.nodes.get(parent.parentId)
      }
      yield child
      continue
    }

    if (isParent) {
      const node = expandCollapseNode(
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
      const parent = explorerTree.nodes.get(child.parentId)
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
  treeNodes: Set<string>,
  matcher: (node: UITaskTreeNode) => boolean,
): Generator<[match: boolean, node: UITaskTreeNode]> {
  const match = matcher(node)

  if (match) {
    if (isTestNode(node)) {
      let parent = explorerTree.nodes.get(node.parentId)
      while (parent) {
        treeNodes.add(parent.id)
        parent = explorerTree.nodes.get(parent.parentId)
      }
    }
    else if (isFileNode(node)) {
      treeNodes.add(node.id)
    }
    else {
      treeNodes.add(node.id)
      let parent = explorerTree.nodes.get(node.parentId)
      while (parent) {
        treeNodes.add(parent.id)
        parent = explorerTree.nodes.get(parent.parentId)
      }
    }
  }

  yield [match, node]
  if (isParentNode(node)) {
    for (let i = 0; i < node.tasks.length; i++) {
      yield * visitNode(node.tasks[i], treeNodes, matcher)
    }
  }
}

function matcher(node: UITaskTreeNode, search: string, filter: Filter) {
  const task = client.state.idMap.get(node.id)
  return task ? matchTask(task, search, filter) : false
}
