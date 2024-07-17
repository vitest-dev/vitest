import type { Suite, Task } from '../types/tasks'

/**
 * Partition in tasks groups by consecutive concurrent
 */
export function partitionSuiteChildren(suite: Suite): Task[][] {
  let tasksGroup: Task[] = []
  const tasksGroups: Task[][] = []
  for (const c of suite.tasks) {
    if (tasksGroup.length === 0 || c.concurrent === tasksGroup[0].concurrent) {
      tasksGroup.push(c)
    }
    else {
      tasksGroups.push(tasksGroup)
      tasksGroup = [c]
    }
  }
  if (tasksGroup.length > 0) {
    tasksGroups.push(tasksGroup)
  }

  return tasksGroups
}
