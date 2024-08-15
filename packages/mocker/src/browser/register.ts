import { spyOn } from '@vitest/spy'
import type { ModuleMockerMSWInterceptorOptions } from './interceptor'
import { ModuleMocker, ModuleMockerMSWInterceptor } from './index'

declare const __VITEST_GLOBAL_THIS_ACCESSOR__: string
declare const __VITEST_MOCKER_ROOT__: string
declare const __VITEST_MSW_OPTIONS__: ModuleMockerMSWInterceptorOptions

const hot = import.meta.hot!

if (!hot) {
  console.warn('Vitest mocker cannot work if Vite didn\'t establish WS connection.')
}

;(globalThis as any)[__VITEST_GLOBAL_THIS_ACCESSOR__] = new ModuleMocker(
  new ModuleMockerMSWInterceptor(__VITEST_MSW_OPTIONS__),
  {
    resolveId(id, importer) {
      return send('vitest:mocks:resolveId', { id, importer })
    },
    resolveMock(id, importer, options) {
      return send('vitest:mocks:resolveMock', { id, importer, options })
    },
    async invalidate(ids) {
      return send('vitest:mocks:invalidate', { ids })
    },
  },
  spyOn,
  {
    root: __VITEST_MOCKER_ROOT__,
  },
)

function send<T>(event: string, data: any) {
  hot.send(event, data)
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Failed to resolve ${event} in time`))
    }, 5_000)
    hot.on(`${event}:result`, function r(data) {
      resolve(data)
      clearTimeout(timeout)
      hot.off('vitest:mocks:resolvedId:result', r)
    })
  })
}
