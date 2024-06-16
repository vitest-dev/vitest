export type RawErrsMap = Map<string, TscErrorInfo[]>
export interface TscErrorInfo {
  filePath: string
  errCode: number
  errMsg: string
  line: number
  column: number
}
export interface CollectLineNumbers {
  target: number
  next: number
  prev?: number
}
export type CollectLines = {
  [key in keyof CollectLineNumbers]: string;
}
export interface RootAndTarget {
  root: string
  targetAbsPath: string
}
export type Context = RootAndTarget & {
  rawErrsMap: RawErrsMap
  openedDirs: Set<string>
  lastActivePath?: string
}
