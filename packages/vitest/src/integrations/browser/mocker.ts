import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'pathe'
import { isNodeBuiltin } from 'vite-node/utils'
import type { WorkspaceProject } from '../../node/workspace'

export class VitestBrowserServerMocker {
  // string means it will read from __mocks__ folder
  // undefined means there is a factory mock that will be called on the server
  // null means it should be auto mocked
  public mocks = new Map<
    string,
    { sessionId: string; mock: string | null | undefined }
  >()

  // private because the typecheck fails on build if it's exposed
  // due to a self reference
  #project: WorkspaceProject

  constructor(project: WorkspaceProject) {
    this.#project = project
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
    const resolved = await this.#project.browser!.pluginContainer.resolveId(
      rawId,
      importer,
      {
        ssr: false,
      },
    )
    return this.#project.vitenode.resolveModule(rawId, resolved)
  }

  public resolveMockPath(mockPath: string, external: string | null) {
    const path = external || mockPath

    // it's a node_module alias
    // all mocks should be inside <root>/__mocks__
    if (external || isNodeBuiltin(mockPath) || !existsSync(mockPath)) {
      const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
      const mockFolder = join(
        this.#project.config.root,
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
