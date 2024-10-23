import type { ModuleMockerCompilerHints } from './hints'
import type { ModuleMockerInterceptor } from './index'
import { spyOn } from '@vitest/spy'
import { createCompilerHints } from './hints'
import { ModuleMocker } from './index'
import { hot, rpc } from './utils'

declare const __VITEST_GLOBAL_THIS_ACCESSOR__: string
declare const __VITEST_MOCKER_ROOT__: string

export function registerModuleMocker(
  interceptor: (accessor: string) => ModuleMockerInterceptor,
): ModuleMockerCompilerHints {
  const mocker = new ModuleMocker(
    interceptor(__VITEST_GLOBAL_THIS_ACCESSOR__),
    {
      resolveId(id, importer) {
        return rpc('vitest:mocks:resolveId', { id, importer })
      },
      resolveMock(id, importer, options) {
        return rpc('vitest:mocks:resolveMock', { id, importer, options })
      },
      async invalidate(ids) {
        return rpc('vitest:mocks:invalidate', { ids })
      },
    },
    spyOn,
    {
      root: __VITEST_MOCKER_ROOT__,
    },
  )

  ;(globalThis as any)[__VITEST_GLOBAL_THIS_ACCESSOR__] = mocker

  registerNativeFactoryResolver(mocker)

  return createCompilerHints({
    globalThisKey: __VITEST_GLOBAL_THIS_ACCESSOR__,
  })
}

export function registerNativeFactoryResolver(mocker: ModuleMocker): void {
  hot.on('vitest:interceptor:resolve', async (url: string) => {
    const exports = await mocker.resolveFactoryModule(url)
    const keys = Object.keys(exports)
    hot.send('vitest:interceptor:resolved', { url, keys })
  })
}
