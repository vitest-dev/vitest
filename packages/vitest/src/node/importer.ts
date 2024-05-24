import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner'
import type { ViteResolvedConfig } from '../types/config'
import { VitestDevEnvironemnt } from './environment'

export class VitestServerImporter {
  public readonly environment: VitestDevEnvironemnt

  private readonly runner: ModuleRunner

  constructor(public readonly config: ViteResolvedConfig) {
    this.environment = new VitestDevEnvironemnt('vitest', config)
    this.runner = new ModuleRunner(
      {
        root: config.root,
        transport: {
          fetchModule: (id, importer) => this.environment.fetchModule(id, importer),
        },
      },
      new ESModulesEvaluator(),
    )
  }

  get processor() {
    return this.environment.processor
  }

  import(id: string) {
    return this.runner.import(id)
  }

  init() {
    return this.environment.init()
  }

  async close() {
    await Promise.all([
      this.runner.destroy(),
      this.environment.close(),
    ])
  }
}
