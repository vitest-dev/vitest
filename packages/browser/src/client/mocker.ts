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
    try {
      this.mocks[id] = await factory()
      return this.mocks[id]
    }
    catch (err) {
      const vitestError = new Error(
        '[vitest] There was an error when mocking a module. '
        + 'If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. '
        + 'Read more: https://vitest.dev/api/vi.html#vi-mock',
      )
      vitestError.cause = err
      throw vitestError
    }
  }

  public queueMock(id: string, importer: string, factory?: () => any) {
    const promise = rpc().queueMock(id, importer, !!factory)
      .then((id) => {
        this.factories[id] = factory!
      }).finally(() => {
        this.queue.delete(promise)
      })
    this.queue.add(promise)
  }

  public queueUnmock(id: string, importer: string) {
    const promise = rpc().queueUnmock(id, importer)
      .then((id) => {
        delete this.factories[id]
      }).finally(() => {
        this.queue.delete(promise)
      })
    this.queue.add(promise)
  }

  public async prepare() {
    if (!this.queue.size)
      return
    await Promise.all([...this.queue.values()])
  }
}
