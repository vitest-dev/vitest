import fs, { promises as fsp } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isFileServingAllowed } from 'vitest/node'
import type { BrowserCommand, WorkspaceProject } from 'vitest/node'
import type Types from '../../../commands'

function assertFileAccess(path: string, project: WorkspaceProject) {
  const resolvedPath = resolve(path)
  if (!isFileServingAllowed(resolvedPath, project.server) && !isFileServingAllowed(resolvedPath, project.ctx.server))
    throw new Error(`Access denied to "${resolvedPath}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`)
}

export const readFile: BrowserCommand<Parameters<typeof Types.readFile>> = async ([path, options], { project }) => {
  assertFileAccess(path, project)
  return fsp.readFile(path, options)
}

export const writeFile: BrowserCommand<Parameters<typeof Types.writeFile>> = async ([path, data, options], { project }) => {
  assertFileAccess(path, project)
  const dir = dirname(path)
  if (!fs.existsSync(dir))
    await fsp.mkdir(dir, { recursive: true })
  await fsp.writeFile(path, data, options)
}

export const removeFile: BrowserCommand<Parameters<typeof Types.removeFile>> = async ([path], { project }) => {
  assertFileAccess(path, project)
  await fsp.rm(path)
}
