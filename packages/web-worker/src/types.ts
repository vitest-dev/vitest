export type Procedure = (...args: any[]) => void
export type CloneOption = 'native' | 'ponyfill' | 'none'

export type PostMessageArgs = [
  unknown,
  StructuredSerializeOptions | Transferable[] | undefined,
]

export interface DefineWorkerOptions {
  clone: CloneOption
}
