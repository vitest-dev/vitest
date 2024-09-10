import fs from 'node:fs'
import { builtinModules } from 'node:module'
import { basename, dirname, extname, join, resolve } from 'pathe'

const { existsSync, readdirSync, statSync } = fs

export function findMockRedirect(
  root: string,
  mockPath: string,
  external: string | null,
): string | null {
  const path = external || mockPath

  // it's a node_module alias
  // all mocks should be inside <root>/__mocks__
  if (external || isNodeBuiltin(mockPath) || !existsSync(mockPath)) {
    const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
    const mockFolder = join(root, '__mocks__', mockDirname)

    if (!existsSync(mockFolder)) {
      return null
    }

    const baseOriginal = basename(path)

    function findFile(mockFolder: string, baseOriginal: string): string | null {
      const files = readdirSync(mockFolder)
      for (const file of files) {
        const baseFile = basename(file, extname(file))
        if (baseFile === baseOriginal) {
          const path = resolve(mockFolder, file)
          // if the same name, return the file
          if (statSync(path).isFile()) {
            return path
          }
          else {
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

    return findFile(mockFolder, baseOriginal)
  }

  const dir = dirname(path)
  const baseId = basename(path)
  const fullPath = resolve(dir, '__mocks__', baseId)
  return existsSync(fullPath) ? fullPath : null
}

const builtins = new Set([
  ...builtinModules,
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

const prefixedBuiltins = new Set(['node:test', 'node:sqlite'])
const NODE_BUILTIN_NAMESPACE = 'node:'
function isNodeBuiltin(id: string): boolean {
  if (prefixedBuiltins.has(id)) {
    return true
  }
  return builtins.has(
    id.startsWith(NODE_BUILTIN_NAMESPACE)
      ? id.slice(NODE_BUILTIN_NAMESPACE.length)
      : id,
  )
}
