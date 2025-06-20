export type Procedure = (...args: any[]) => void
export type CloneOption = 'native' | 'ponyfill' | 'none'

export interface DefineWorkerOptions {
  clone: CloneOption
}
