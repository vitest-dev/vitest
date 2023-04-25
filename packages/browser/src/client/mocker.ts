function throwNotImplemented(name: string) {
  throw new Error(`[vitest] ${name} is not implemented in browser environment yet.`)
}

export class VitestBrowserClientMocker {
  public importActual() {
    throwNotImplemented('importActual')
  }

  public importMock() {
    throwNotImplemented('importMock')
  }

  public queueMock() {
    throwNotImplemented('queueMock')
  }

  public queueUnmock() {
    throwNotImplemented('queueUnmock')
  }

  public prepare() {
    // TODO: prepare
  }
}
