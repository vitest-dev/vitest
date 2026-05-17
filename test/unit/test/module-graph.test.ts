import { describe, expect, it } from 'vitest'
import { getModuleGraph } from 'vitest/src/utils/graph.js'

interface TestModule {
  file: string
  id: string
  importedModules: Set<TestModule>
}

function defineTestModule(id: string, imports: TestModule[] = []): TestModule {
  return {
    file: id,
    id,
    importedModules: new Set(imports),
  }
}

function defineTestContext(
  root: TestModule,
  wasExternalized: (id: string) => string | false = () => false,
) {
  const modules = new Map<string, TestModule>()
  const visit = (mod: TestModule) => {
    modules.set(mod.id, mod)
    mod.importedModules.forEach(visit)
  }
  visit(root)

  return {
    getProjectByName: () => ({
      _resolver: {
        wasExternalized,
      },
      config: {
        experimental: {
          viteModuleRunner: false,
        },
        setupFiles: [],
      },
      vite: {
        environments: {
          __vitest__: {
            moduleGraph: {
              getModuleById: (id: string) => modules.get(id),
            },
          },
        },
      },
    }),
  } as any
}

describe('getModuleGraph', () => {
  it('skips inlined node_modules branches when requested', async () => {
    const nestedDependency = defineTestModule('/repo/node_modules/pkg/nested.js')
    const packageEntry = defineTestModule('/repo/node_modules/pkg/index.js', [nestedDependency])
    const localDependency = defineTestModule('/repo/src/local.ts')
    const root = defineTestModule('/repo/src/root.test.ts', [localDependency, packageEntry])

    const graph = await getModuleGraph(
      defineTestContext(root),
      '',
      root.id,
      false,
      { excludeNodeModules: true },
    )

    expect(graph.inlined).toEqual([root.id, localDependency.id])
    expect(graph.externalized).toEqual([])
    expect(graph.graph[root.id]).toEqual([localDependency.id])
    expect(graph.graph[packageEntry.id]).toBeUndefined()
    expect(graph.graph[nestedDependency.id]).toBeUndefined()
  })

  it('keeps externalized package labels when node_modules are hidden', async () => {
    const packageEntry = defineTestModule('/repo/node_modules/pkg/index.js')
    const root = defineTestModule('/repo/src/root.test.ts', [packageEntry])

    const graph = await getModuleGraph(
      defineTestContext(root, id => id === packageEntry.id ? 'pkg' : false),
      '',
      root.id,
      false,
      { excludeNodeModules: true },
    )

    expect(graph.inlined).toEqual([root.id])
    expect(graph.externalized).toEqual(['pkg'])
    expect(graph.graph[root.id]).toEqual(['pkg'])
  })
})
