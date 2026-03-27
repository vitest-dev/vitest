import type { Vitest } from '../core'
import * as fsSync from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** @experimental */
export interface Report {
  /**
   * The root directory for this scope.
   *
   * ```ts
   * const report = vitest.createReport('my-json-reporter');
   *
   * // Is <project-root>/.vitest/my-json-reporter
   * const root = report.root
   * ```
   */
  root: string

  /**
   * Clean up the report directory for this scope.
   *
   * By default, if `--merge-reports` is used, this method will not delete existing reports.
   * To force deletion of existing reports, pass `true` as an argument.
   *
   * ```ts
   * const report = vitest.createReport('my-json-reporter');
   *
   * // Removes everything inside <project-root>/.vitest/my-json-reporter/
   * await report.clean()
   * ```
   */
  clean: (force?: boolean) => Promise<void>

  /**
   * Write a file to the report directory for this scope.
   * By default the file will be written with UTF-8 encoding.
   * The filename is relative to the scope directory.
   *
   * ```ts
   * const report = vitest.createReport('my-json-reporter');
   *
   * // Writes file to .vitest/my-json-reporter/test-report.json
   * await report.writeFile('test-report.json', JSON.stringify(results))
   * ```
   */
  writeFile: (filename: string, content: Parameters<typeof writeFile>[1], encoding?: BufferEncoding) => Promise<void>

  /**
   * Read a file from the report directory for this scope.
   *
   * ```ts
   * const report = vitest.createReport('my-json-reporter');
   *
   * // Reads file from .vitest/my-json-reporter/test-report.json
   * const content: string = await report.readFile('test-report.json')
   * ```
   */
  readFile: (filename: string, encoding?: BufferEncoding) => Promise<string>

  /**
   * Read contents of the report directory for this scope.
   *
   * ```ts
   * const report = vitest.createReport('my-json-reporter');
   *
   * // Reads contents from .vitest/my-json-reporter
   * const filenames: string[] = await report.readdir()
   * ```
   */
  readdir: () => Promise<string[]>

  /**
   * Delete a file from the report directory for this scope.
   *
   * ```ts
   * const report = vitest.createReport('my-json-reporter');
   *
   * // Deletes file from .vitest/my-json-reporter/test-report.json
   * await report.delete('test-report.json')
   * ```
   */
  delete: (filename: string) => Promise<void>
}

export function createReport(ctx: Vitest, scope: string): Report {
  const root = ctx.config.root
  const vitestDir = resolve(root, '.vitest')
  const reportDir = resolve(vitestDir, scope)

  if (!fsSync.existsSync(vitestDir)) {
    fsSync.mkdirSync(vitestDir)
  }

  if (!fsSync.existsSync(reportDir)) {
    fsSync.mkdirSync(reportDir)
  }

  return {
    root: reportDir,

    async clean(force = false) {
      if (fsSync.existsSync(reportDir)) {
        // Do not delete results when run with --merge-reports, unless forced to.
        // In test runs with --shard, it's possible that users do some other handling for
        // the reports after 'vitest --merge-reports' run. For example upload all the '.vitest/attachments'.
        if (ctx.config.mergeReports && !force) {
          return
        }

        await rm(reportDir, { recursive: true, force: true })
      }

      await mkdir(reportDir)
    },

    async readFile(filename, encoding = 'utf8') {
      return await readFile(resolve(vitestDir, scope, filename), encoding)
    },

    async readdir() {
      return await readdir(resolve(vitestDir, scope))
    },

    async writeFile(filename, content, encoding = 'utf8') {
      await writeFile(resolve(vitestDir, scope, filename), content, encoding)
    },

    async delete(filename) {
      await rm(resolve(vitestDir, scope, filename), { recursive: true, force: true })
    },
  }
}
