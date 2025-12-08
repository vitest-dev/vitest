import { pathToFileURL } from 'node:url'
import { isAbsolute, resolve } from 'pathe'
import { ModuleRunner } from 'vite/module-runner'

export class NativeModuleRunner extends ModuleRunner {
  constructor(private root: string) {
    super({
      hmr: false,
      transport: {
        invoke() {
          throw new Error('Unexpected `invoke`')
        },
      },
    })
  }

  override import(moduleId: string): Promise<any> {
    if (!isAbsolute(moduleId)) {
      moduleId = resolve(this.root, moduleId)
    }
    if (!moduleId.startsWith('file://')) {
      moduleId = pathToFileURL(moduleId).toString()
    }
    return import(moduleId)
  }
}
