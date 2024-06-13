import type { UIFile, UISuite, UITest } from '~/composables/explorer/types'
import { recalculateUITreeExplorer } from '~/composables/explorer/search'
import { client } from '~/composables/client'
import { uiFiles } from '~/composables/explorer/tree'

export function collapseUIEntry(entry: UITest, forAll = false) {
  if (!entry.expandable || !entry.expanded)
    return

  entry.expanded = false
  !forAll && recalculateUITreeExplorer()
}

export function collapseAllUIEntries() {
  for (const entry of uiFiles.value)
    collapseUIEntry(entry as UIFile, true)

  recalculateUITreeExplorer()
}

export function expandUIEntry(indent: number, entry: UITest, forAll = false) {
  if (!entry.expandable || entry.expanded)
    return

  const task = client.state.idMap.get(entry.id)
  if (!task || !('tasks' in task))
    return

  const suite = entry as UISuite

  if (!suite.tasks.length) {
    for (const t of task.tasks) {
      if ('tasks' in task) {
        suite.tasks.push(shallowReactive(<UISuite>{
          id: t.id,
          name: t.name,
          mode: t.mode,
          parent: entry,
          expandable: false,
          expanded: false,
          tasks: [],
          indent: indent + 1,
        }))
      }
      else {
        suite.tasks.push(reactive(<UITest>{
          id: t.id,
          name: t.name,
          mode: t.mode,
          parent: entry,
          expandable: false,
          expanded: false,
          indent: indent + 1,
        }))
      }
    }
  }

  if (!suite.tasks.length)
    return

  entry.expanded = true

  if (forAll) {
    for (const e of suite.tasks)
      expandUIEntry(indent + 1, e, true)
  }
  else {
    recalculateUITreeExplorer()
  }
}

export function expandAllUIEntries(dontRecalculate = false) {
  for (const entry of uiFiles.value)
    expandUIEntry(0, entry, true)

  !dontRecalculate && recalculateUITreeExplorer()
}
