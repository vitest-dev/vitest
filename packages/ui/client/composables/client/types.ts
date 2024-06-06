import type { RunMode, TaskState } from '@vitest/runner'

export interface UIFile {
  id: string
  name: string
  mode: RunMode
  state?: TaskState
  duration?: number
  filepath: string
  projectName: string
  collectDuration?: number
  setupDuration?: number
  environmentLoad?: number
  prepareDuration?: number
}
