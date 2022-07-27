import type { Environment, EnvironmentOptions } from '../../types'
import { populateGlobal } from './utils'

// https://miniflare.dev/testing/ava#isolated-tests
export default <Environment>({
  name: 'miniflare',
  async setup(global, { miniflare: options }: { miniflare: EnvironmentOptions['miniflare'] }) {
    const { Miniflare } = await import('miniflare')

    const miniflare = new Miniflare({
      // Autoload configuration from `.env`, `package.json` and `wrangler.toml`
      envPath: true,
      packagePath: true,
      wranglerConfigPath: true,

      sourceMap: true,
      scriptRequired: false,

      // Disable checks that we're running inside a request handler
      // https://github.com/cloudflare/miniflare/issues/292#issuecomment-1165450037
      globalTimers: true,
      globalAsyncIO: true,
      globalRandom: true,

      ...options,

      // We don't want to rebuild our worker for each test, we're already doing
      // it once before we run all tests in package.json, so disable it here.
      // This will override the option in wrangler.toml.
      buildCommand: undefined,
    })

    populateGlobal(global, { miniflare })

    return {
      async teardown() {
        await miniflare.dispose()
      },
    }
  },
})
