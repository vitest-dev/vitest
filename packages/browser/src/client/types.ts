export interface IframeInitEvent {
  event: 'init'
  method: 'run' | 'collect'
  files: string[]
  iframeId: string
  context: string
}
