import { RunMode, Suite, TaskOrSuite } from './types'

/**
 * Partition in tasks groups by consecutive computeMode ('serial', 'concurrent')
 */
export function partitionSuiteChildren(suite: Suite) {
  let childrenGroup: TaskOrSuite[] = []
  const childrenGroups: TaskOrSuite[][] = []
  for (const c of suite.children) {
    if (childrenGroup.length === 0 || c.computeMode === childrenGroup[0].computeMode) {
      childrenGroup.push(c)
    }
    else {
      childrenGroups.push(childrenGroup)
      childrenGroup = [c]
    }
  }
  if (childrenGroup.length > 0)
    childrenGroups.push(childrenGroup)

  return childrenGroups
}

/**
 * If any items been marked as `only`, mark all other items as `skip`.
 */
export function interpretOnlyMode(items: { mode: RunMode }[]) {
  if (items.some(i => i.mode === 'only')) {
    items.forEach((i) => {
      if (i.mode === 'run')
        i.mode = 'skip'
      else if (i.mode === 'only')
        i.mode = 'run'
    })
  }
}
