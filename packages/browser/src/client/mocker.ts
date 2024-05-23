import { rpc } from './rpc'

function throwNotImplemented(name: string) {
  throw new Error(`[vitest] ${name} is not implemented in browser environment yet.`)
}

export class VitestBrowserClientMocker {
  private queue = new Set<Promise<void>>()
  private mocks: Record<string, any> = {}
  private factories: Record<string, () => any> = {}

  public importActual() {
    throwNotImplemented('importActual')
  }

  public importMock() {
    throwNotImplemented('importMock')
  }

  public get(id: string) {
    return this.mocks[id]
  }

  public async resolve(id: string) {
    const factory = this.factories[id]
    if (!factory)
      throw new Error(`Cannot resolve ${id} mock: no factory provided`)
    this.mocks[id] = await factory()
    return this.mocks[id]
  }

  public queueMock(id: string, importer: string, factory?: () => any) {
    const promise = rpc().queueMock(id, importer).then((id) => {
      this.factories[id] = factory! // TODO: support no factory mocks
    }).finally(() => {
      this.queue.delete(promise)
    })
    this.queue.add(promise)
  }

  public queueUnmock(_id: string, _importer: string) {
    throwNotImplemented('queueUnmock')
  }

  public async prepare() {
    if (!this.queue.size)
      return
    await Promise.all([...this.queue.values()])
  }
}
