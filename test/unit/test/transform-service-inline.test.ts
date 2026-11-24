import { describe, expect, it, vi } from 'vitest'
import { ModuleTransformService } from '../../../packages/vitest/src/node/environments/transformService.js'

function createService(code: string) {
  const moduleGraphModule = {
    url: '/src/mod.ts',
    id: '/src/mod.ts',
    file: '/src/mod.ts',
    transformResult: {
      code,
      map: null,
      __vitestModuleType: 'module' as const,
      __vitestStaticMocks: null,
      __vitestSourceMap: null,
    },
  }
  const environment = {
    name: 'client',
    config: { root: process.cwd() },
    moduleGraph: {
      getModuleByUrl: vi.fn(async () => moduleGraphModule),
      getModuleById: vi.fn(async () => moduleGraphModule),
      ensureEntryFromUrl: vi.fn(async () => moduleGraphModule),
    },
    fetchModule: vi.fn(async () => ({
      code,
      file: '/src/mod.ts',
      id: '/src/mod.ts',
      url: '/src/mod.ts',
      invalidate: false,
    })),
  }
  const resolver = {
    resolve: vi.fn(async () => null),
    shouldExternalize: vi.fn(async () => false),
  }
  const traces = {
    waitInit: vi.fn(async () => {}),
    getContextFromCarrier: vi.fn(),
    $: (_name: string, _opts: unknown, fn: (span: unknown) => unknown) =>
      fn({ setAttribute: vi.fn(), setAttributes: vi.fn() }),
  }
  const service = new ModuleTransformService(
    resolver as any,
    { root: process.cwd(), fsModuleCache: false, experimental: {} } as any,
    {
      getCachePath: () => null,
      recordManifestModule: vi.fn(),
      getModule: vi.fn(),
      setModule: vi.fn(),
      save: vi.fn(),
    } as any,
    traces as any,
    '/tmp/vitest-test',
  )
  vi.spyOn(service as any, 'fetchAndProcess').mockResolvedValue({
    code,
    file: '/src/mod.ts',
    id: '/src/mod.ts',
    url: '/src/mod.ts',
    invalidate: false,
  })
  return { service, environment }
}

describe('ModuleTransformService inline small fork transforms', () => {
  it('returns small transforms inline when fsModuleCache is disabled and cacheFs is true', async () => {
    const smallCode = 'export const x = 1\n'
    const { service, environment } = createService(smallCode)
    const cacheResultSpy = vi.spyOn(service as any, 'cacheResult')

    const res = await service.fetch('/src/mod.ts', undefined, environment as any, true)

    expect('code' in res && res.code).toBe(smallCode)
    expect('tmp' in res).toBe(false)
    expect(cacheResultSpy).not.toHaveBeenCalled()
  })

  it('writes large transforms to tmp file when fsModuleCache is disabled and cacheFs is true', async () => {
    const largeCode = `export const x = "${'a'.repeat(5000)}"\n`
    const { service, environment } = createService(largeCode)
    const cacheResultSpy = vi
      .spyOn(service as any, 'cacheResult')
      .mockResolvedValue({
        cached: true,
        file: '/src/mod.ts',
        id: '/src/mod.ts',
        tmp: '/tmp/mock-file',
        url: '/src/mod.ts',
        invalidate: false,
      })

    const res = await service.fetch('/src/mod.ts', undefined, environment as any, true)

    expect(cacheResultSpy).toHaveBeenCalledOnce()
    expect('tmp' in res && res.tmp).toBe('/tmp/mock-file')
  })
})
