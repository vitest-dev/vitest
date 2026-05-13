import type { BaselineData } from '@vitest/runner'
import type { Vitest } from './core'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'pathe'

export class BenchmarkManager {
  constructor(private vitest: Vitest) {}

  // Resolve a user-supplied path against the project root. Reject paths that
  // escape the project root: `bench.from()` accepts arbitrary input, and we
  // never want a benchmark file to be able to read or clobber files outside
  // the workspace.
  public resolve(relativePath: string): string {
    const root = this.vitest.config.root
    const absolute = isAbsolute(relativePath)
      ? resolve(relativePath)
      : resolve(root, relativePath)
    const rootWithSep = root.endsWith('/') ? root : `${root}/`
    if (absolute !== root && !absolute.startsWith(rootWithSep)) {
      throw new Error(
        `Benchmark artifact path "${relativePath}" resolves outside the project root (${root}). `
        + `Paths passed to \`writeResult\` and \`bench.from()\` must point inside the project.`,
      )
    }
    return absolute
  }

  async readResult(path: string): Promise<BaselineData | null> {
    if (!existsSync(path)) {
      return null
    }
    return JSON.parse(await readFile(path, 'utf-8')) as BaselineData
  }

  async writeResult(relativePath: string, data: BaselineData): Promise<void> {
    const absolute = this.resolve(relativePath)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
  }
}
