import fs, { promises as fsp } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { isFileServingAllowed } from 'vite'
import type { WorkspaceProject } from 'vitest/node'
import type { BrowserCommand } from '../types'

export interface FsOptions {
  encoding?: BufferEncoding
  flag?: string | number
}

function assertFileAccess(path: string, project: WorkspaceProject) {
  const resolvedPath = resolve(path)
  if (!isFileServingAllowed(resolvedPath, project.server) && !isFileServingAllowed(resolvedPath, project.ctx.server))
    throw new Error(`Access denied to "${resolvedPath}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`)
}

export const readFile: BrowserCommand<[string, BufferEncoding | FsOptions]> = async ([path, options], { project }) => {
  assertFileAccess(path, project)
  return fsp.readFile(path, options).catch(() => null)
}

export const writeFile: BrowserCommand<[string, string, BufferEncoding | FsOptions & { mode?: number | string }]> = async ([path, data, options], { project }) => {
  assertFileAccess(path, project)
  const dir = dirname(path)
  if (!fs.existsSync(dir))
    await fsp.mkdir(dir, { recursive: true })
  await fsp.writeFile(path, data, options).catch(() => null)
}

export const removeFile: BrowserCommand<[string]> = async ([path], { project }) => {
  assertFileAccess(path, project)
  await fsp.rm(path).catch(() => null)
}
