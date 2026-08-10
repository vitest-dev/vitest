import type { BrowserCommand } from 'vitest/node'
import type { IstanbulCoverageProvider } from './provider'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'pathe'

export const commands: Record<string, BrowserCommand<any[]>> = {
  writeCoverageFile(context, coverage: unknown) {
    const provider = context.project.vitest.coverageProvider as IstanbulCoverageProvider

    return writeCoverageFile(provider.coverageFilesDirectory, coverage)
  },
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
