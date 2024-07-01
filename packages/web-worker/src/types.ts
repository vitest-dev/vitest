export type Procedure = (...args: any[]) => void
export type CloneOption = 'native' | 'ponyfill' | 'none'

export interface DefineWorkerOptions {
  clone: CloneOption
}

export interface InlineWorkerContext {
  onmessage: Procedure | null
  name?: string
  close: () => void
  dispatchEvent: (e: Event) => void
  addEventListener: (e: string, fn: Procedure) => void
  removeEventListener: (e: string, fn: Procedure) => void
  postMessage: (
    data: any,
    transfer?: Transferable[] | StructuredSerializeOptions
  ) => void
  self: InlineWorkerContext
  global: InlineWorkerContext
  importScripts?: any
}
