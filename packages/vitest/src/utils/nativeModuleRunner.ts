import type { TestModuleMocker } from '@vitest/mocker'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { isBareImport } from '@vitest/utils/helpers'
import { isAbsolute, resolve } from 'pathe'
import { ModuleRunner } from 'vite/module-runner'

const __require = createRequire(import.meta.url)

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
      // better to use `import.meta.resolve`, but it's experimental
      // this works in most cases, except where there is no `default` or `import` would be preferable
      // if there is a commonjs condition in package.json, it will be preferred over esm
      // TODO: revisit the solution
      return import(__require.resolve(moduleId, { paths: [this.root] }))
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
