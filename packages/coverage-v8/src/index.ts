import type { Profiler } from 'node:inspector'
import type { CoverageProviderModule } from 'vitest/node'
import type { ScriptCoverageWithOffset, V8CoverageProvider } from './provider'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import inspector from 'node:inspector/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalize } from 'pathe'
import { provider } from 'std-env'
import { loadProvider } from './load-provider'

let enabled = false

const mod: CoverageProviderModule & {
  extendedContextCoverageDir?: string
  // Use unknown to avoid bundling node:inspector
  session?: unknown | null
} = {
  extendedContextCoverageDir: undefined,
  session: null,

  async startCoverage({ isolate, autoAttachSubprocess, reportsDirectory }) {
    if (isolate === false && enabled) {
      return
    }

    enabled = true

    if (autoAttachSubprocess) {
      this.extendedContextCoverageDir = resolve(reportsDirectory, 'tmp', randomUUID())
      process.env.NODE_V8_COVERAGE = this.extendedContextCoverageDir
    }

    this.session ||= new inspector.Session()
    const session = this.session as inspector.Session

    session.connect()
    await session.post('Profiler.enable')
    await session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: true })
  },

  async takeCoverage(options): Promise<{ result: ScriptCoverageWithOffset[] }> {
    if (provider === 'stackblitz') {
      return { result: [] }
    }

    const session = this.session as inspector.Session

    if (!session) {
      throw new Error('V8 provider missing inspector session.')
    }

    const coverage = await session.post('Profiler.takePreciseCoverage')
    const result: ScriptCoverageWithOffset[] = []

    // Reduce amount of data sent over rpc by doing some early result filtering
    for (const entry of coverage.result as ScriptCoverageWithOffset[]) {
      if (filterResult(entry)) {
        entry.startOffset = options?.moduleExecutionInfo?.get(normalize(fileURLToPath(entry.url)))?.startOffset || 0

        result.push(entry)
      }
    }

    if (this.extendedContextCoverageDir && existsSync(this.extendedContextCoverageDir)) {
      const filenames = await readdir(this.extendedContextCoverageDir)
      const contents = await Promise.all(
        filenames
          .filter(filename => filename.endsWith('.json'))
          .map(async (filename) => {
            const path = `${this.extendedContextCoverageDir}/${filename}`

            const content = await readFile(path, 'utf8')
            await rm(path)

            return content
          }),
      )

      for (const content of contents) {
        const json: { result: ScriptCoverageWithOffset[] } = JSON.parse(content)

        for (const entry of json.result) {
          if (filterResult(entry)) {
            entry.startOffset = 0
            entry.isExtendedContext = true

            result.push(entry)
          }
        }
      }
    }

    return { result }
  },

  async stopCoverage({ isolate }) {
    if (isolate === false) {
      return
    }

    const session = this.session as inspector.Session

    if (!session) {
      throw new Error('V8 provider missing inspector session.')
    }

    await session.post('Profiler.stopPreciseCoverage')
    await session.post('Profiler.disable')
    session.disconnect()
    this.session = null
  },

  async getProvider(): Promise<V8CoverageProvider> {
    return loadProvider()
  },
}
export default mod

function filterResult(coverage: Profiler.ScriptCoverage): boolean {
  if (!coverage.url.startsWith('file://')) {
    return false
  }

  if (coverage.url.includes('/node_modules/')) {
    return false
  }

  if (coverage.url.includes('/@id/@vitest/')) {
    return false
  }

  if (coverage.url.includes('/@vite/client')) {
    return false
  }

  return true
}
