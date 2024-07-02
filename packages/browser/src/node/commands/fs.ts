import fs, { promises as fsp } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isFileServingAllowed } from 'vitest/node'
import type { BrowserCommand, WorkspaceProject } from 'vitest/node'
import type { BrowserCommands } from '../../../context'

function assertFileAccess(path: string, project: WorkspaceProject) {
  if (
    !isFileServingAllowed(path, project.server)
    && !isFileServingAllowed(path, project.ctx.server)
  ) {
    throw new Error(
      `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`,
    )
  }
}

export const readFile: BrowserCommand<
  Parameters<BrowserCommands['readFile']>
> = async ({ project, testPath = process.cwd() }, path, options = {}) => {
  const filepath = resolve(dirname(testPath), path)
  assertFileAccess(filepath, project)
  // never return a Buffer
  if (typeof options === 'object' && !options.encoding) {
    options.encoding = 'utf-8'
  }
  return fsp.readFile(filepath, options)
}

export const writeFile: BrowserCommand<
  Parameters<BrowserCommands['writeFile']>
> = async ({ project, testPath = process.cwd() }, path, data, options) => {
  const filepath = resolve(dirname(testPath), path)
  assertFileAccess(filepath, project)
  const dir = dirname(filepath)
  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true })
  }
  await fsp.writeFile(filepath, data, options)
}

export const removeFile: BrowserCommand<
  Parameters<BrowserCommands['removeFile']>
> = async ({ project, testPath = process.cwd() }, path) => {
  const filepath = resolve(dirname(testPath), path)
  assertFileAccess(filepath, project)
  await fsp.rm(filepath)
}
