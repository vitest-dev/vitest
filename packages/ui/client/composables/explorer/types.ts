import type { RunMode, TaskState } from '@vitest/runner'

export type FilterResult = [match: boolean, node: UITaskTreeNode]

export interface FilteredTests {
  failed: number
  success: number
  skipped: number
  running: number
}

export interface CollectFilteredTests extends FilteredTests {
  total: number
  ignored: number
  todo: number
}

export interface TaskTreeNode {
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
  projectName?: string
  projectNameColor: string
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
  project: string
}

export interface TreeFilterState extends Filter {
  search: string
  expandAll?: boolean
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
  totalTests: number
  failedSnapshot: boolean
  failedSnapshotEnabled: boolean
}
