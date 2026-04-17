import type { BaselineData } from '@vitest/runner'
import type { Vitest } from './core'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'pathe'

export class BenchmarkManager {
  constructor(private vitest: Vitest) {}

  private resolveBaselinePath(testFilepath: string): string {
    return resolve(dirname(testFilepath), '__benchmarks__', `${basename(testFilepath)}.json`)
  }

  async readBaseline(testFilepath: string, key: string): Promise<BaselineData | null> {
    const baselinePath = this.resolveBaselinePath(testFilepath)
    if (!existsSync(baselinePath)) {
      return null
    }
    const content = JSON.parse(readFileSync(baselinePath, 'utf-8'))
    return content[key] ?? null
  }

  async saveBaseline(testFilepath: string, key: string, data: BaselineData): Promise<void> {
    const updateBaselines = this.vitest.config.benchmark?.updateBaselines || this.vitest.config.updateBaselines
    const baselinePath = this.resolveBaselinePath(testFilepath)
    let content: Record<string, BaselineData> = {}
    if (existsSync(baselinePath)) {
      content = JSON.parse(readFileSync(baselinePath, 'utf-8'))
    }
    // always write on first run (no existing baseline), overwrite all when --update-baselines
    if (updateBaselines || !(key in content)) {
      content[key] = data
      await mkdir(dirname(baselinePath), { recursive: true })
      await writeFile(baselinePath, `${JSON.stringify(content, null, 2)}\n`, 'utf-8')
    }
  }
}
