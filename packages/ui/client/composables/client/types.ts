import type { RunMode, TaskState } from '@vitest/runner'

export interface UIEntry {
  id: string
  name: string
  mode: RunMode
  state?: TaskState
  duration?: number
}

export interface UIFile extends UIEntry {
  filepath: string
  projectName: string
  collectDuration?: number
  setupDuration?: number
  environmentLoad?: number
  prepareDuration?: number
  expanded: boolean
}

export interface UITest extends UIEntry {
  parentUI: string
}

export interface UISuite extends UITest {
  parentUI: string
  expanded: boolean
}