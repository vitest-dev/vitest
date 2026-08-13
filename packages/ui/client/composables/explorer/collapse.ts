import type { ExplorerOperationContext, UITaskTreeNode } from '~/composables/explorer/types'
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
 * @param context The explorer operation context.
 * @param id The node id to collapse.
 */
export function runCollapseNode(context: ExplorerOperationContext, id: string) {
  const node = context.nodes.get(id)
  if (!node || !isParentNode(node)) {
    return
  }

  const treeItems = new Set(openedTreeItems.value)
  treeItems.delete(node.id)
  const entries = [...collectCollapseNode(node)]
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
export function runCollapseAllTask(context: ExplorerOperationContext) {
  // collapse all nodes
  collapseAllNodes(context.root.tasks)
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

function* collectChildNodes(node: UITaskTreeNode, itself: boolean): Generator<string> {
  if (itself) {
    yield node.id
  }

  if (isParentNode(node)) {
    for (let i = 0; i < node.tasks.length; i++) {
      yield* collectChildNodes(node.tasks[i], true)
    }
  }
}

function* collectCollapseNode(node: UITaskTreeNode) {
  const id = node.id
  // collect children to remove from the list
  const childNodes = new Set<string>(collectChildNodes(node, false))
  for (let i = 0; i < uiEntries.value.length; i++) {
    const child = uiEntries.value[i]
    // collapse current node and return it
    if (child.id === id) {
      child.expanded = false
      yield child
      continue
    }

    // remove children from the list
    if (childNodes.has(child.id)) {
      childNodes.delete(child.id)
      continue
    }

    // return the node
    yield child
  }
}
