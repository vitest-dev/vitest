import type { UITaskTreeNode } from '~/composables/explorer/types'
import { replaceSubtreeEntries } from '~/composables/explorer/entries'
import { explorerTree } from '~/composables/explorer/index'
import { openedTreeItems, treeFilter, uiEntries } from '~/composables/explorer/state'
import { isFileNode, isParentNode } from '~/composables/explorer/utils'

/**
 * Collapse all nodes: all children collapsed.
 *
 * This method will use current `uiEntries`, we don't need to traverse the full tree.
 * The action will be applied on the current items in the test results explorer.
 *
 * If the node is not a parent node, nothing will happen.
 *
 * Calling this method will:
 * - collapse all nodes
 * - remove opened tree items for the node and any children
 * - update uiEntries without child nodes
 *
 * @param id The node id to collapse.
 */
export function runCollapseNode(id: string) {
  const node = explorerTree.nodes.get(id)
  if (!node || !isParentNode(node)) {
    return
  }

  node.expanded = false
  const treeItems = new Set(openedTreeItems.value)
  treeItems.delete(node.id)
  const entries = replaceSubtreeEntries(uiEntries.value, node, [node])
  openedTreeItems.value = Array.from(treeItems)
  // Keep expandAll state as it is: collapsing individual shouldn't prevent collapsing all the nodes ("collapse all" button)
  // There is a watcher on composable search.ts to reset to undefined expandAll if there are no opened items
  // treeFilter.value.expandAll = true
  uiEntries.value = entries
}

/**
 * Collapse all nodes: any child collapsed.
 *
 * This method will use current `uiEntries`, we don't need to traverse the full tree.
 * The action will be applied on the current items in the test results explorer.
 *
 * We'll use current `uiEntries`, we don't need to traverse the full tree.
 *
 * Calling this method will:
 * - collapse all nodes
 * - clear stored opened tree items
 * - update the filtered expandAll state to true
 * - update uiEntries without child nodes
 *
 */
export function runCollapseAllTask() {
  // collapse all nodes
  collapseAllNodes(explorerTree.root.tasks)
  const entries = [...uiEntries.value.filter(isFileNode)]
  collapseAllNodes(entries)
  // collapse all nodes
  openedTreeItems.value = []
  treeFilter.value.expandAll = true
  uiEntries.value = entries
}

function collapseAllNodes(nodes: UITaskTreeNode[]) {
  for (const node of nodes) {
    if (isParentNode(node)) {
      node.expanded = false
      collapseAllNodes(node.tasks)
    }
  }
}
