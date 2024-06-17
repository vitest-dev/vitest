import { filteredFiles, openedTreeItems, treeFilter, uiEntries } from '~/composables/explorer/state'
import type { FileTreeNode, Filter, UITaskTreeNode } from '~/composables/explorer/types'
import { createOrUpdateNode, createOrUpdateSuiteTask, isFileNode, isParentNode } from '~/composables/explorer/utils'
import { filterAll, filterTask } from '~/composables/explorer/filter'
import { findById } from '~/composables/client'

/**
 * Expand the node: only direct children will be expanded
 *
 * This method will use current `uiEntries`, we don't need to traverse the full tree.
 * The action will be applied on the current items in the test results explorer.
 *
 * **Note:** we only need to apply the filter on child nodes, when filtering, parent nodes
 * are not present in the explorer if don't match the filter, only those matching the criteria
 * will be there, we only need to filter the children of the node to expand.
 *
 * Calling this method will:
 * - update the filtered expandAll state
 * - remove opened tree items for the node and any children
 * - update uiEntries including child nodes
 *
 * @param id The node id to expand.
 * @param nodes Tree node map.
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runExpandNode(
  id: string,
  nodes: Map<string, UITaskTreeNode>,
  search: string,
  filter: Filter,
) {
  const entry = createOrUpdateSuiteTask(
    id,
    nodes,
    false,
  )
  if (!entry) {
    return
  }

  const [node, task] = entry

  // create only direct children
  for (const subtask of task.tasks) {
    createOrUpdateNode(node.id, subtask, nodes, false)
  }

  // expand the node
  node.expanded = true

  const treeItems = new Set(openedTreeItems.value)
  treeItems.add(node.id)
  // collect children
  // the first node is itself
  const children = new Set(filterTask(
    node,
    nodes,
    search,
    filter,
  ))

  const entries = [...collectExpandedNode(node, children)]
  openedTreeItems.value = Array.from(treeItems)
  treeFilter.value.expandAll = false
  uiEntries.value = entries
}

/**
 * Expand all nodes: any child expanded.
 *
 * This method will use current `uiEntries`, we don't need to traverse the full tree.
 * The action will be applied on the current items in the test results explorer.
 *
 * Any already expanded child will be shown as expanded: collapsing nodes will not collapse any child.
 *
 * **Note:** we don't need to apply the filter here, we'll use the current `uiEntries`, when filtering,
 * parent nodes are not present in the explorer, only those matching the criteria will be there.
 * The filter will be applied to the full tree.
 *
 * Calling this method will:
 * - expand all nodes
 * - add stored opened tree items
 * - update the filtered expandAll state to true
 * - update uiEntries with child nodes
 *
 * @param nodes Tree node map.
 * @param nodeTree Tree node map.
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runExpandAll(
  nodes: FileTreeNode[],
  nodeTree: Map<string, UITaskTreeNode>,
  search: string,
  filter: Filter,
) {
  expandAllNodes(nodes, false)
  const entries = [...filterAll(
    nodes,
    nodeTree,
    search,
    filter,
  )]
  treeFilter.value.expandAll = false
  openedTreeItems.value = []
  uiEntries.value = entries
  filteredFiles.value = entries.filter(isFileNode).map(f => findById(f.id)!)
}

export function expandNodesOnEndRun(
  ids: Set<string>,
  nodes: Map<string, UITaskTreeNode>,
  updateState: boolean,
) {
  if (ids.size) {
    for (const node of nodes.values()) {
      if (ids.has(node.id)) {
        node.expanded = true
      }
    }
  }
  else {
    expandAllNodes(uiEntries.value.filter(isFileNode), updateState)
  }
}

export function expandAllNodes(nodes: UITaskTreeNode[], updateState: boolean) {
  for (const node of nodes) {
    if (isParentNode(node)) {
      node.expanded = true
      expandAllNodes(node.tasks, false)
    }
  }

  if (updateState) {
    treeFilter.value.expandAll = false
    openedTreeItems.value = []
  }
}

function* collectExpandedNode(
  node: UITaskTreeNode,
  children: Set<UITaskTreeNode>,
) {
  const id = node.id

  for (const node of uiEntries.value) {
    if (node.id === id) {
      yield * children
    }
    else {
      yield node
    }
  }
}
