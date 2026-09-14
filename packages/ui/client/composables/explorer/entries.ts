import type { UITaskTreeNode } from '~/composables/explorer/types'

export function replaceSubtreeEntries(
  entries: readonly UITaskTreeNode[],
  node: UITaskTreeNode,
  subtree: readonly UITaskTreeNode[],
) {
  const start = entries.findIndex(entry => entry.id === node.id)
  if (start < 0) {
    return [...entries]
  }

  let end = start + 1
  while (end < entries.length && entries[end].indent > node.indent) {
    end++
  }

  return [
    ...entries.slice(0, start),
    ...subtree,
    ...entries.slice(end),
  ]
}
