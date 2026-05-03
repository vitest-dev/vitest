import type { BaselineData, TestBenchmarkTask } from '@vitest/runner'
import type { Vitest } from './core'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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
    const content = JSON.parse(await readFile(baselinePath, 'utf-8'))
    return content[key] ?? null
  }

  async saveBaselines(
    testFilepath: string,
    projectName: string | undefined,
    testFullName: string,
    tasks: TestBenchmarkTask[],
  ): Promise<void> {
    const updateBaselines = this.vitest.config.benchmark?.updateBaselines || this.vitest.config.updateBaselines
    const baselinePath = this.resolveBaselinePath(testFilepath)
    let content: Record<string, BaselineData> = {}
    if (existsSync(baselinePath)) {
      content = JSON.parse(await readFile(baselinePath, 'utf-8'))
    }

    let changed = false
    for (const task of tasks) {
      const key = projectName
        ? `${projectName} > ${testFullName} > ${task.name}`
        : `${testFullName} > ${task.name}`
      if (updateBaselines || !(key in content)) {
        content[key] = {
          latency: task.latency,
          throughput: task.throughput,
          period: task.period,
          totalTime: task.totalTime,
        }
        changed = true
      }
    }

    if (changed) {
      await mkdir(dirname(baselinePath), { recursive: true })
      await writeFile(baselinePath, `${JSON.stringify(content, null, 2)}\n`, 'utf-8')
    }
  }
}
