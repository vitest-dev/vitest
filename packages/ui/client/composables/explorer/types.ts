import type { RunMode, TaskState } from '@vitest/runner'

export interface UITest {
  id: string
  name: string
  mode: RunMode
  state?: TaskState
  duration?: number
  indent: number
  expandable: boolean
  expanded: boolean
}

export interface UISuite extends UITest {
  tasks: UITest[]
}

export interface UIFile extends UISuite {
  filepath: string
  projectName: string
  collectDuration?: number
  setupDuration?: number
  environmentLoad?: number
  prepareDuration?: number
}

export interface Filter {
  failed: boolean
  success: boolean
  skipped: boolean
  onlyTests: boolean
}
