import path from 'node:path'
import { slash } from '@vitest/utils/helpers'
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
  return files.map(file => slash(path.resolve(cwd, file)))
}
