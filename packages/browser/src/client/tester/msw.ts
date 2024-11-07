import { ModuleMockerMSWInterceptor } from '@vitest/mocker/browser'
import { getConfig } from '../utils'

export function createModuleMockerInterceptor() {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  return new ModuleMockerMSWInterceptor({
    globalThisAccessor: '"__vitest_mocker__"',
    mswOptions: {
      serviceWorker: {
        url: '/mockServiceWorker.js',
        options: {
          scope: '/',
        },
      },
      onUnhandledRequest: 'bypass',
      quiet: !(debug && debug !== 'false'),
    },
  })
}
