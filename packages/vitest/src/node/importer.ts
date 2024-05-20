import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner'
import type { ViteResolvedConfig } from '../types/config'
import { VitestDevEnvironemnt } from './environment'

export class VitestServerImporter extends VitestDevEnvironemnt {
  #runner: ModuleRunner
  #root: string

  constructor(config: ViteResolvedConfig) {
    // <_< sorry
    let root = () => config.root
    super('vitest', {
      ...config,
      get root() {
        return root()
      },
    })
    root = () => this.#root

    this.#root = config.root
    this.#runner = new ModuleRunner(
      {
        get root() {
          return root()
        },
        transport: {
          fetchModule: (id, importer) => this.fetchModule(id, importer),
        },
      },
      new ESModulesEvaluator(),
    )
  }

  withRoot(root: string) {
    this.#root = root
    return this
  }

  import(id: string) {
    return this.#runner.import(id)
  }
}
