import type { UITaskTreeNode } from '~/composables/explorer/types'
import { isParentNode } from '~/composables/explorer/utils'

export function lookupOpenedTreeItems(entries: UITaskTreeNode[]) {
  return [...collectOpenedTreeItems(entries)]
}

export function* collectRestoreTreeItems(ids: Set<string>, nodes: Map<string, UITaskTreeNode>): Generator<UITaskTreeNode> {
  if (ids.size === 0) {
    for (const node of nodes.values())
      yield node
  }
  else {
    for (const node of nodes.values()) {
      if (ids.has(node.id))
        yield node
    }
  }
}

function* collectOpenedTreeItems(entries: UITaskTreeNode[]): Generator<string> {
  for (const entry of entries) {
    if (isParentNode(entry) && entry.expanded) {
      yield entry.id
      yield * collectOpenedTreeItems(entry.tasks)
    }
  }
}
