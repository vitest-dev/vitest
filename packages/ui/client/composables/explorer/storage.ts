import type { UITaskTreeNode } from '~/composables/explorer/types'
import { isParentNode } from '~/composables/explorer/utils'

export function lookupOpenedTreeItems(entries: UITaskTreeNode[]) {
  return [...collectOpenedTreeItems(entries)]
}

function* collectOpenedTreeItems(entries: UITaskTreeNode[]): Generator<string> {
  for (const entry of entries) {
    if (isParentNode(entry) && entry.expanded) {
      yield entry.id
      yield * collectOpenedTreeItems(entry.tasks)
    }
  }
}
