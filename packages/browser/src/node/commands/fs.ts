import type { BrowserCommands } from 'vitest/browser'
import type { BrowserCommand, TestProject } from 'vitest/node'
import fs, { promises as fsp } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import mime from 'mime/lite'
import { isFileLoadingAllowed } from 'vitest/node'
import { slash } from '../utils'

function assertFileAccess(path: string, project: TestProject) {
  if (
    !isFileLoadingAllowed(project.vite.config, path)
    && !isFileLoadingAllowed(project.vitest.vite.config, path)
  ) {
    throw new Error(
      `Access denied to "${path}". See Vite config documentation for "server.fs": https://vitejs.dev/config/server-options.html#server-fs-strict.`,
    )
  }
}

function assertWrite(path: string, project: TestProject) {
  if (!project.config.browser.api.allowWrite || !project.vitest.config.api.allowWrite) {
    throw new Error(`Cannot modify file "${path}". File writing is disabled because server is exposed to the internet, see https://vitest.dev/config/browser/api.`)
  }
}

export const readFile: BrowserCommand<
  Parameters<BrowserCommands['readFile']>
> = async ({ project }, path, options = {}) => {
  const filepath = resolve(project.config.root, path)
  assertFileAccess(slash(filepath), project)
  // never return a Buffer
  if (typeof options === 'object' && !options.encoding) {
    options.encoding = 'utf-8'
  }
  return fsp.readFile(filepath, options)
}

export const writeFile: BrowserCommand<
  Parameters<BrowserCommands['writeFile']>
> = async ({ project }, path, data, options) => {
  assertWrite(path, project)
  const filepath = resolve(project.config.root, path)
  assertFileAccess(slash(filepath), project)
  const dir = dirname(filepath)
  if (!fs.existsSync(dir)) {
    await fsp.mkdir(dir, { recursive: true })
  }
  await fsp.writeFile(filepath, data, options)
}

export const removeFile: BrowserCommand<
  Parameters<BrowserCommands['removeFile']>
> = async ({ project }, path) => {
  assertWrite(path, project)
  const filepath = resolve(project.config.root, path)
  assertFileAccess(slash(filepath), project)
  await fsp.rm(filepath)
}

export const _fileInfo: BrowserCommand<[path: string, encoding: BufferEncoding]> = async ({ project }, path, encoding) => {
  const filepath = resolve(project.config.root, path)
  assertFileAccess(slash(filepath), project)
  const content = await fsp.readFile(filepath, encoding || 'base64')
  return {
    content,
    basename: basename(filepath),
    mime: mime.getType(filepath),
  }
}
