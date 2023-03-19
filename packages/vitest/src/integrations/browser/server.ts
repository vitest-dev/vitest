import { createServer } from 'vite'
import { resolve } from 'pathe'
import { findUp } from 'find-up'
import { configFiles } from '../../constants'
import type { Vitest } from '../../node'
import type { UserConfig } from '../../types/config'
import { ensurePackageInstalled } from '../../node/pkg'
import { resolveApiServerConfig } from '../../node/config'

export async function createBrowserServer(ctx: Vitest, options: UserConfig) {
  const root = ctx.config.root

  await ensurePackageInstalled('@vitest/browser', root)

  const configPath = options.config === false
    ? false
    : options.config
      ? resolve(root, options.config)
      : await findUp(configFiles, { cwd: root } as any)

  const server = await createServer({
    logLevel: 'error',
    mode: ctx.config.mode,
    configFile: configPath,
    // watch is handled by Vitest
    server: {
      hmr: false,
      watch: {
        ignored: ['**/**'],
      },
    },
    plugins: [
      (await import('@vitest/browser')).default('/'),
      {
        enforce: 'post',
        name: 'vitest:browser:config',
        config(config) {
          const server = resolveApiServerConfig(config.test?.browser || {}) || {
            port: 63315,
          }

          config.server = server
          config.test ??= {}
          config.test.browser ??= {}
          config.test.browser.api = server
        },
      },
    ],
  })

  await server.listen()
  await server.watcher.close()

  ;(await import('../../api/setup')).setup(ctx, server)

  return server
}
