import { BareModuleMocker } from './bareModuleMocker'

export class NativeModuleMocker extends BareModuleMocker {
  public wrapDynamicImport<T>(moduleFactory: () => Promise<T>): Promise<T> {
    if (typeof moduleFactory === 'function') {
      const promise = new Promise<T>((resolve, reject) => {
        this.resolveMocks().finally(() => {
          moduleFactory().then(resolve, reject)
        })
      })
      return promise
    }
    return moduleFactory
  }

  public getFactoryModule(id: string): any {
    const registry = this.getMockerRegistry()
    const mock = registry.getById(id)
    if (!mock || mock.type !== 'manual') {
      throw new Error(`Mock ${id} wasn't registered. This is probably a Vitest error. Please, open a new issue with reproduction.`)
    }
    return mock.resolve()
  }
}
