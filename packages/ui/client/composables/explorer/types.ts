import type { RunMode, RunnerTask as Task, TaskState } from 'vitest'

export type FilterResult = [match: boolean, node: UITaskTreeNode]

export interface FilteredTests {
  failed: number
  success: number
  skipped: number
  running: number
}

export interface SearchMatcher {
  (task: Task): boolean
}

export interface CollectFilteredTests extends FilteredTests {
  total: number
  ignored: number
  todo: number
  expectedFail: number
  slow: number
}

interface TaskTreeNode {
  id: string
  expandable: boolean
  expanded: boolean
}

export interface RootTreeNode extends TaskTreeNode {
  tasks: FileTreeNode[]
}

export type TaskTreeNodeType = 'file' | 'suite' | 'test'

export interface UITaskTreeNode extends TaskTreeNode {
  type: TaskTreeNodeType
  name: string
  parentId: string
  mode: RunMode
  indent: number
  state?: TaskState
  duration?: number
  slow?: boolean
  typecheck?: boolean
  label?: string
  projectName?: string
}

export interface TestTreeNode extends UITaskTreeNode {
  fileId: string
  type: 'test'
}

export interface ParentTreeNode extends UITaskTreeNode {
  children: Set<string>
  tasks: UITaskTreeNode[]
}

export interface SuiteTreeNode extends ParentTreeNode {
  fileId: string
  type: 'suite'
}

export interface FileTreeNode extends ParentTreeNode {
  type: 'file'
  filepath: string
  typecheck: boolean | undefined
  label?: string
  projectName?: string
  collectDuration?: number
  setupDuration?: number
  environmentLoad?: number
  prepareDuration?: number
}

export interface Filter {
  failed: boolean
  success: boolean
  skipped: boolean
  slow: boolean
  onlyTests: boolean
}

type ProjectSortType = 'asc' | 'desc'
type DurationSortType = 'duration-asc' | 'duration-desc'
type SortType = ProjectSortType | DurationSortType
export type SortUIType = SortType | 'default'

export interface TreeFilterState extends Filter {
  search: string
  expandAll?: boolean
  project?: string
  projectSort?: SortType
}

export interface CollectorInfo {
  files: number
  time: string
  filesFailed: number
  filesSuccess: number
  filesIgnore: number
  filesRunning: number
  filesSkipped: number
  filesTodo: number
  filesSnapshotFailed: number
  testsFailed: number
  testsSuccess: number
  testsIgnore: number
  testsSkipped: number
  testsTodo: number
  testsExpectedFail: number
  testsSlow: number
  totalTests: number
  failedSnapshot: boolean
  failedSnapshotEnabled: boolean
}
