import { spyOn } from '@vitest/spy'
import type { SetupWorker, StartOptions } from 'msw/browser'
import type { ModuleMockerCompilerHints } from './hints'
import { createCompilerHints } from './hints'
import { ModuleMocker, ModuleMockerMSWInterceptor } from './index'

declare const __VITEST_GLOBAL_THIS_ACCESSOR__: string
declare const __VITEST_MOCKER_ROOT__: string

const hot = import.meta.hot!

if (!hot) {
  console.warn('Vitest mocker cannot work if Vite didn\'t establish WS connection.')
}

export function registerModuleMocker({ mswOptions, mswWorker }: {
  /**
   * Options passed down to `msw.setupWorker().start(options)`
   */
  mswOptions?: StartOptions
  /**
   * A pre-configured `msw.setupWorker` instance.
   */
  mswWorker?: SetupWorker
} = {}): ModuleMockerCompilerHints {
  ;(globalThis as any)[__VITEST_GLOBAL_THIS_ACCESSOR__] = new ModuleMocker(
    new ModuleMockerMSWInterceptor({
      globalThisAccessor: __VITEST_GLOBAL_THIS_ACCESSOR__,
      mswOptions,
      mswWorker,
    }),
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
  return createCompilerHints({
    globalThisKey: __VITEST_GLOBAL_THIS_ACCESSOR__,
  })
}

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
