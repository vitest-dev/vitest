import type { TestModuleMocker } from '@vitest/mocker'
import { pathToFileURL } from 'node:url'
import { isBareImport } from '@vitest/utils/helpers'
import { resolveModule } from 'local-pkg'
import { isAbsolute, resolve } from 'pathe'
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

  override import(moduleId: string): Promise<any> {
    if (isBareImport(moduleId)) {
      const path = resolveModule(moduleId, { paths: [this.root] })
        ?? resolve(this.root, moduleId)
      return import(path)
    }
    if (!isAbsolute(moduleId)) {
      moduleId = resolve(this.root, moduleId)
    }
    if (!moduleId.startsWith('file://')) {
      moduleId = pathToFileURL(moduleId).toString()
    }
    return import(moduleId)
  }
}
