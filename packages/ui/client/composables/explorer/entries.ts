import type { UITaskTreeNode } from '~/composables/explorer/types'
import { isParentNode } from '~/composables/explorer/utils'

export function replaceSubtreeEntries(
  entries: readonly UITaskTreeNode[],
  node: UITaskTreeNode,
  subtree: readonly UITaskTreeNode[],
) {
  const descendants = new Set<string>()
  collectDescendantIds(node, descendants)
  const result: UITaskTreeNode[] = []
  for (const entry of entries) {
    if (entry.id === node.id) {
      result.push(...subtree)
    } else if (!descendants.has(entry.id)) {
      result.push(entry)
    }
  }
  return result
}

function collectDescendantIds(node: UITaskTreeNode, ids: Set<string>) {
  if (isParentNode(node)) {
    for (const child of node.tasks) {
      ids.add(child.id)
      collectDescendantIds(child, ids)
    }
  }
}
