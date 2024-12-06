import type { Filter, UITaskTreeNode } from '~/composables/explorer/types'
import { findById } from '~/composables/client'
import { filterAll, filterNode } from '~/composables/explorer/filter'
import { explorerTree } from '~/composables/explorer/index'
import { filteredFiles, openedTreeItems, treeFilter, uiEntries } from '~/composables/explorer/state'
import { createOrUpdateNode, createOrUpdateSuiteTask, isFileNode, isParentNode } from '~/composables/explorer/utils'

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
 * - remove opened tree items for the node and any children
 * - update uiEntries including child nodes
 *
 * @param id The node id to expand.
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runExpandNode(
  id: string,
  search: string,
  filter: Filter,
) {
  const entry = createOrUpdateSuiteTask(
    id,
    false,
  )
  if (!entry) {
    return
  }

  const [node, task] = entry

  // create only direct children
  for (const subtask of task.tasks) {
    createOrUpdateNode(node.id, subtask, false)
  }

  // expand the node
  node.expanded = true

  const treeItems = new Set(openedTreeItems.value)
  treeItems.add(node.id)
  // collect children
  // the first node is itself only when it is a file
  const children = new Set(filterNode(
    node,
    search,
    filter,
  ))

  const entries = [...collectExpandedNode(node, children)]
  openedTreeItems.value = Array.from(treeItems)
  // Keep expandAll state as it is: expanding individual shouldn't prevent expanding all the nodes ("expand all" button)
  // There is a watcher on composable search.ts to reset to undefined expandAll if there are no opened items
  // treeFilter.value.expandAll = false
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
 * - update the filtered expandAll state to false
 * - update uiEntries with child nodes
 *
 * @param search The search applied.
 * @param filter The filter applied.
 */
export function runExpandAll(
  search: string,
  filter: Filter,
) {
  expandAllNodes(explorerTree.root.tasks, false)
  const entries = [...filterAll(
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
  end: boolean,
) {
  if (ids.size) {
    for (const node of uiEntries.value) {
      if (ids.has(node.id)) {
        node.expanded = true
      }
    }
  }
  else if (end) {
    expandAllNodes(uiEntries.value.filter(isFileNode), true)
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
  const ids = new Set(Array.from(children).map(n => n.id))

  for (const child of uiEntries.value) {
    if (child.id === id) {
      child.expanded = true
      if (!ids.has(child.id)) {
        yield node
      }
      yield * children
    }
    else if (!ids.has(child.id)) {
      yield child
    }
  }
}
