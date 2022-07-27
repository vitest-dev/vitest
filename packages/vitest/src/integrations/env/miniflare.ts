import type { Environment } from '../../types'
import { populateGlobal } from './utils'

// https://miniflare.dev/testing/ava#isolated-tests
export default <Environment>({
  name: 'miniflare',
  async setup(global, { miniflare: options }) {
    const { Miniflare } = await import('miniflare')

    const miniflare = new Miniflare({
      // Autoload configuration from `.env`, `package.json` and `wrangler.toml`
      envPath: true,
      packagePath: true,
      wranglerConfigPath: true,
      // We don't want to rebuild our worker for each test, we're already doing
      // it once before we run all tests in package.json, so disable it here.
      // This will override the option in wrangler.toml.
      buildCommand: undefined,

      sourceMap: true,
      scriptRequired: false,

      // Disable checks that we're running inside a request handler
      globalTimers: true,
      globalAsyncIO: true,
      globalRandom: true,

      ...options,
    })

    populateGlobal(global, { miniflare })

    return {
      async teardown() {
        await miniflare.dispose()
      },
    }
  },
})
