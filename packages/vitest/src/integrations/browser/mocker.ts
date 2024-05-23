import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'pathe'
import { cleanUrl, isNodeBuiltin } from 'vite-node/utils'
import type { WorkspaceProject } from '../../node/workspace'

export class VitestBrowserServerMocker {
  // string means it will read from __mocks__ folder
  // undefined means there is a factory mock that will be called on the server
  // null means it should be auto mocked
  public mocks = new Map<string, string | null | undefined>()

  // private because the typecheck fails on build if it's exposed
  // due to a self reference
  #project: WorkspaceProject

  constructor(project: WorkspaceProject) {
    this.#project = project
  }

  async mock(rawId: string, importer: string, hasFactory: boolean) {
    const { id, fsPath, external } = await this.resolveId(rawId, importer)

    this.invalidateModuleById(id)

    if (hasFactory) {
      this.mocks.set(id, undefined)
      return id
    }

    const mockPath = this.resolveMockPath(fsPath, external)
    this.mocks.set(id, mockPath)

    return id
  }

  async unmock(rawId: string, importer: string) {
    const { id } = await this.resolveId(rawId, importer)

    this.invalidateModuleById(id)
    this.mocks.delete(id)
    return id
  }

  public invalidateModuleById(id: string) {
    const moduleGraph = this.#project.browser!.moduleGraph
    const module = moduleGraph.getModuleById(id)
    if (module)
      moduleGraph.invalidateModule(module)
  }

  private async resolveId(rawId: string, importer: string) {
    const resolved = await this.#project.vitenode.resolveId(rawId, importer, 'web')
    const id = resolved?.id || rawId
    const external = (!isAbsolute(id) || this.isModuleDirectory(id)) ? rawId : null
    return {
      id,
      fsPath: cleanUrl(id),
      external,
    }
  }

  private isModuleDirectory(path: string) {
    const moduleDirectories = this.#project.config.deps.moduleDirectories || ['/node_modules/']
    return moduleDirectories.some((dir: string) => path.includes(dir))
  }

  private resolveMockPath(mockPath: string, external: string | null) {
    const path = external || mockPath

    // it's a node_module alias
    // all mocks should be inside <root>/__mocks__
    if (external || isNodeBuiltin(mockPath) || !existsSync(mockPath)) {
      const mockDirname = dirname(path) // for nested mocks: @vueuse/integration/useJwt
      const mockFolder = join(this.#project.config.root, '__mocks__', mockDirname)

      if (!existsSync(mockFolder))
        return null

      const files = readdirSync(mockFolder)
      const baseOriginal = basename(path)

      for (const file of files) {
        const baseFile = basename(file, extname(file))
        if (baseFile === baseOriginal)
          return resolve(mockFolder, file)
      }

      return null
    }

    const dir = dirname(path)
    const baseId = basename(path)
    const fullPath = resolve(dir, '__mocks__', baseId)
    return existsSync(fullPath) ? fullPath : null
  }
}
