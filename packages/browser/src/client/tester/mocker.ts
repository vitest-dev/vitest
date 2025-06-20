import { ModuleMocker } from '@vitest/mocker/browser'
import { getBrowserState } from '../utils'

export class VitestBrowserClientMocker extends ModuleMocker {
  // default "vi" utility tries to access mock context to avoid circular dependencies
  public getMockContext() {
    return { callstack: null }
  }

  public override wrapDynamicImport<T>(moduleFactory: () => Promise<T>): Promise<T> {
    return getBrowserState().wrapModule(moduleFactory)
  }
}
