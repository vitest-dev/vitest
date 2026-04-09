import type { Vitest } from '../core'
import * as fsSync from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

interface ResultWriter {
  clean: () => Promise<void>
  write: (filename: string, result: Parameters<typeof writeFile>[1], encoding?: BufferEncoding) => Promise<void>
  read: (filename: string, encoding?: BufferEncoding) => Promise<string>
  delete: (filename: string) => Promise<void>
}

export function createResultWriter(ctx: Vitest, scope: string): ResultWriter {
  const root = ctx.config.root
  const vitestDir = resolve(root, '.vitest')
  const resultsDir = resolve(vitestDir, scope)

  if (!fsSync.existsSync(vitestDir)) {
    fsSync.mkdirSync(vitestDir)
  }

  if (!fsSync.existsSync(resultsDir)) {
    fsSync.mkdirSync(resultsDir)
  }

  return {
    /**
     * Clean up the results directory for this scope.
     */
    async clean() {
      if (fsSync.existsSync(resultsDir)) {
        await rm(resultsDir, { recursive: true, force: true })
      }

      await mkdir(resultsDir)
    },

    /**
     * Read a result file from the results directory for this scope.
     *
     * ```ts
     * const resultWriter = vitest.createResultWriter('my-json-reporter');
     *
     * // Reads file from .vitest/my-json-reporter/test-results.json
     * const content: string = await resultWriter.read('test-results.json')
     * ```
     */
    async read(filename, encoding = 'utf8') {
      return await readFile(resolve(vitestDir, scope, filename), encoding)
    },

    /**
     * Write a result file to the results directory for this scope.
     * By default, the file will be written with UTF-8 encoding, but a different encoding can be specified if needed.
     * The filename is relative to the scope directory.
     *
     * ```ts
     * const resultWriter = vitest.createResultWriter('my-json-reporter');
     *
     * // Writes file to .vitest/my-json-reporter/test-results.json
     * await resultWriter.write('test-results.json', JSON.stringify(results), 'utf8')
     * ```
     */
    async write(filename, result, encoding = 'utf8') {
      await writeFile(resolve(vitestDir, scope, filename), result, encoding)
    },

    /**
     * Delete a result file from the results directory for this scope.
     *
     * ```ts
     * const resultWriter = vitest.createResultWriter('my-json-reporter');
     *
     * // Deletes file from .vitest/my-json-reporter/test-results.json
     * await resultWriter.delete('test-results.json')
     * ```
     */
    async delete(filename) {
      await rm(resolve(vitestDir, scope, filename), { recursive: true, force: true })
    },
  }
}
