import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { slash } from '@vitest/utils/helpers'
import { isAbsolute, join, relative } from 'pathe'
import { glob } from 'tinyglobby'

/**
 * Glob files inside a project's working directory.
 *
 * Resolves with `node:path` (not `pathe`) so the Windows drive-letter casing
 * stays consistent with Vite's, and keeps slashes normalized.
 */
export async function globProjectFiles(
  include: string[],
  exclude: string[],
  cwd: string,
): Promise<string[]> {
  const files = await glob(include, {
    dot: true,
    cwd,
    ignore: exclude,
    expandDirectories: false,
  })
  return files.map((file) => slash(path.resolve(cwd, file)))
}

export function isInSourceTestCode(code: string): boolean {
  return code.includes('import.meta.vitest')
}

/**
 * Glob a project's test files, including in-source test files from
 * `includeSource` that actually contain `import.meta.vitest`. Typecheck test
 * files are not included.
 */
export async function globProjectTestFiles(
  include: string[],
  exclude: string[],
  includeSource: string[] | undefined,
  cwd: string,
): Promise<string[]> {
  const testFiles = await globProjectFiles(include, exclude, cwd)

  if (includeSource?.length) {
    const files = await globProjectFiles(includeSource, exclude, cwd)

    await Promise.all(
      files.map(async (file) => {
        try {
          const code = await readFile(file, 'utf-8')
          if (isInSourceTestCode(code)) {
            testFiles.push(file)
          }
        } catch {
          return null
        }
      }),
    )
  }

  return testFiles
}

/**
 * Keep the test files that match the CLI filters. With no filters, every file matches.
 */
export function filterTestFiles(testFiles: string[], filters: string[], dir: string): string[] {
  if (!filters.length) {
    return testFiles
  }
  if (process.platform === 'win32') {
    filters = filters.map((f) => slash(f))
  }
  return testFiles.filter((t) => {
    const testFile = relative(dir, t).toLocaleLowerCase()
    return filters.some((f) => {
      // if filter is a full file path, we should include it if it's in the same folder
      if (isAbsolute(f) && t.startsWith(f)) {
        return true
      }

      const relativePath = f.endsWith('/') ? join(relative(dir, f), '/') : relative(dir, f)
      return (
        testFile.includes(f.toLocaleLowerCase()) ||
        testFile.includes(relativePath.toLocaleLowerCase())
      )
    })
  })
}
