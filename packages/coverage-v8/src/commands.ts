import type { CDPSession } from '@vitest/browser-playwright'
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'
import type { V8CoverageProvider } from './provider'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'pathe'

export const commands: Record<string, BrowserCommand<any[]>> = {
  startV8Coverage,
  takeV8Coverage,
}

async function startV8Coverage(context: BrowserCommandContext): Promise<void> {
  const session: CDPSession = await context.__ensureCDPHandler()
  await session.send('Profiler.enable')
  await session.send('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })
}

async function takeV8Coverage(context: BrowserCommandContext, pageUrl: string): Promise<string> {
  const session: CDPSession = await context.__ensureCDPHandler()
  const coverage = await session.send('Profiler.takePreciseCoverage')

  const origin = new URL(pageUrl).origin
  const result: typeof coverage.result = []

  for (const entry of coverage.result) {
    if (filterResult(entry.url, origin, pageUrl)) {
      entry.url = decodeURIComponent(entry.url.replace(origin, ''))
      result.push(entry)
    }
  }

  const provider = context.project.vitest.coverageProvider as V8CoverageProvider

  return await writeCoverageFile(provider.coverageFilesDirectory, { result })
}

export async function writeCoverageFile(coverageFilesDirectory: string, coverage: unknown): Promise<string> {
  // Write results on file system directly and transfer only the filename over RPC
  const filename = resolve(
    coverageFilesDirectory,
    `coverage-${randomUUID()}.json`,
  )

  try {
    await writeFile(filename, JSON.stringify(coverage), 'utf-8')
  }
  catch (error) {
    if (!existsSync(coverageFilesDirectory)) {
      throw new Error(
        `Something removed the coverage directory "${coverageFilesDirectory}" Vitest created earlier. Make sure you are not running multiple Vitests with the same "coverage.reportsDirectory" at the same time.`,
        { cause: error },
      )
    }

    throw error
  }

  return filename
}

function filterResult(url: string, origin: string, pageUrl: string): boolean {
  if (!url.startsWith(origin)) {
    return false
  }

  if (url.includes('/node_modules/')) {
    return false
  }

  if (url.includes('__vitest_browser__')) {
    return false
  }

  if (url.includes('__vitest__/assets')) {
    return false
  }

  if (url === pageUrl) {
    return false
  }

  if (url.includes('/@id/@vitest/')) {
    return false
  }

  if (url.includes('/@vite/client')) {
    return false
  }

  return true
}
