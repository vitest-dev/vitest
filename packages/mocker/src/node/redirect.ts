import fs from 'node:fs'
import nodeModule from 'node:module'
import { isBareImport } from '@vitest/utils/helpers'
import { basename, dirname, extname, join, resolve } from 'pathe'

const { existsSync, readdirSync, statSync } = fs

export function findMockRedirect(
  root: string,
  mockPath: string,
  external: string | null,
  rawId?: string,
): string | null {
  const path = external || mockPath

  // it's a node_module alias
  // all mocks should be inside <root>/__mocks__
  if (external || isNodeBuiltin(mockPath) || !existsSync(mockPath)) {
    return findRootMock(root, path)
  }

  // a linked package (like a workspace dependency) resolves outside of node_modules
  if (rawId && isBareImport(rawId)) {
    const rootMock = findRootMock(root, rawId)
    if (rootMock) {
      return rootMock
    }
  }

  const dir = dirname(path)
  const baseId = basename(path)
  const fullPath = resolve(dir, '__mocks__', baseId)
  return existsSync(fullPath) ? fullPath : null
}

function findRootMock(root: string, path: string): string | null {
  const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
  const mockFolder = join(root, '__mocks__', mockDirname)

  if (!existsSync(mockFolder)) {
    return null
  }

  return findFile(mockFolder, basename(path))
}

function findFile(mockFolder: string, baseOriginal: string): string | null {
  const files = readdirSync(mockFolder)
  for (const file of files) {
    const baseFile = basename(file, extname(file))
    if (baseFile === baseOriginal) {
      const path = resolve(mockFolder, file)
      // if the same name, return the file
      if (statSync(path).isFile()) {
        return path
      } else {
        // find folder/index.{js,ts}
        const indexFile = findFile(path, 'index')
        if (indexFile) {
          return indexFile
        }
      }
    }
  }
  return null
}

const builtins = new Set([
  ...nodeModule.builtinModules,
  'assert/strict',
  'diagnostics_channel',
  'dns/promises',
  'fs/promises',
  'path/posix',
  'path/win32',
  'readline/promises',
  'stream/consumers',
  'stream/promises',
  'stream/web',
  'timers/promises',
  'util/types',
  'wasi',
])

// https://nodejs.org/api/modules.html#built-in-modules-with-mandatory-node-prefix
const prefixedBuiltins = new Set(['node:sea', 'node:sqlite', 'node:test', 'node:test/reporters'])
const NODE_BUILTIN_NAMESPACE = 'node:'
function isNodeBuiltin(id: string): boolean {
  // Added in v18.6.0
  if (nodeModule.isBuiltin) {
    return nodeModule.isBuiltin(id)
  }
  if (prefixedBuiltins.has(id)) {
    return true
  }
  return builtins.has(
    id.startsWith(NODE_BUILTIN_NAMESPACE) ? id.slice(NODE_BUILTIN_NAMESPACE.length) : id,
  )
}
