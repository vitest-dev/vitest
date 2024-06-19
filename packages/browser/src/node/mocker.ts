import { existsSync, readdirSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'pathe'
import type { PartialResolvedId } from 'rollup'
import type { WorkspaceProject } from 'vitest/node'

export class VitestBrowserServerMocker {
  // private because the typecheck fails on build if it's exposed
  // due to a self reference
  project: WorkspaceProject

  constructor(project: WorkspaceProject) {
    this.project = project
  }

  public async resolveMock(
    rawId: string,
    importer: string,
    hasFactory: boolean,
  ) {
    const { id, fsPath, external } = await this.resolveId(rawId, importer)

    if (hasFactory) {
      return { type: 'factory' as const, resolvedId: id }
    }

    const mockPath = this.resolveMockPath(fsPath, external)

    return {
      type: mockPath === null ? ('automock' as const) : ('redirect' as const),
      mockPath,
      resolvedId: id,
    }
  }

  private async resolveId(rawId: string, importer: string) {
    const resolved = await this.project.browser!.vite.pluginContainer.resolveId(
      rawId,
      importer,
      {
        ssr: false,
      },
    )
    return this.resolveModule(rawId, resolved)
  }

  private async resolveModule(rawId: string, resolved: PartialResolvedId | null) {
    const id = resolved?.id || rawId
    const external
      = !isAbsolute(id) || this.isModuleDirectory(id) ? rawId : null
    return {
      id,
      fsPath: cleanUrl(id),
      external,
    }
  }

  private isModuleDirectory(path: string) {
    const moduleDirectories = this.project.config.server.deps?.moduleDirectories || [
      '/node_modules/',
    ]
    return moduleDirectories.some((dir: string) => path.includes(dir))
  }

  public resolveMockPath(mockPath: string, external: string | null) {
    const path = external || mockPath

    // it's a node_module alias
    // all mocks should be inside <root>/__mocks__
    if (external || isNodeBuiltin(mockPath) || !existsSync(mockPath)) {
      const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
      const mockFolder = join(
        this.project.config.root,
        '__mocks__',
        mockDirname,
      )

      if (!existsSync(mockFolder)) {
        return null
      }

      const files = readdirSync(mockFolder)
      const baseOriginal = basename(path)

      for (const file of files) {
        const baseFile = basename(file, extname(file))
        if (baseFile === baseOriginal) {
          return resolve(mockFolder, file)
        }
      }

      return null
    }

    const dir = dirname(path)
    const baseId = basename(path)
    const fullPath = resolve(dir, '__mocks__', baseId)
    return existsSync(fullPath) ? fullPath : null
  }
}

const prefixedBuiltins = new Set(['node:test'])

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

const NODE_BUILTIN_NAMESPACE = 'node:'
export function isNodeBuiltin(id: string): boolean {
  if (prefixedBuiltins.has(id)) {
    return true
  }
  return builtins.has(
    id.startsWith(NODE_BUILTIN_NAMESPACE)
      ? id.slice(NODE_BUILTIN_NAMESPACE.length)
      : id,
  )
}

const postfixRE = /[?#].*$/
export function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}
