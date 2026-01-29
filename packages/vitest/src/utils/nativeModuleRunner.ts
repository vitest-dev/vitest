import type { TestModuleMocker } from '@vitest/mocker'
import { pathToFileURL } from 'node:url'
import { resolveModule } from 'local-pkg'
import { resolve } from 'pathe'
import { ModuleRunner } from 'vite/module-runner'

export class NativeModuleRunner extends ModuleRunner {
  /**
   * @internal
   */
  public mocker?: TestModuleMocker

  constructor(private root: string, mocker?: TestModuleMocker) {
    super({
      hmr: false,
      sourcemapInterceptor: false,
      transport: {
        invoke() {
          throw new Error('Unexpected `invoke`')
        },
      },
    })
    this.mocker = mocker
    if (mocker) {
      Object.defineProperty(globalThis, '__vitest_mocker__', {
        configurable: true,
        writable: true,
        value: mocker,
      })
    }
  }

  override async import(moduleId: string): Promise<any> {
    const path = resolveModule(moduleId, { paths: [this.root] })
      ?? resolve(this.root, moduleId)

    // resolveModule doesn't keep the query params, so we need to add them back
    let queryParams = ''
    if (moduleId.includes('?') && !path.includes('?')) {
      queryParams = moduleId.slice(moduleId.indexOf('?'))
    }

    return import(pathToFileURL(path + queryParams).toString())
  }
}
