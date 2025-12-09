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
}
