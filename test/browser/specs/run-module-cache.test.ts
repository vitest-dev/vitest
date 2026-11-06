import type { Plugin } from 'vite'
import { expect, test } from 'vitest'
import { instances, provider, runBrowserTests } from './utils'

function recordSharedModuleResponses() {
  const responses: { status: number; cacheControl?: string }[] = []
  const plugin: Plugin = {
    name: 'record-shared-module-responses',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.on('finish', () => {
          if (req.url && new URL(req.url, 'http://localhost').pathname === '/shared.ts') {
            responses.push({
              status: res.statusCode,
              cacheControl: res.getHeader('cache-control') as string | undefined,
            })
          }
        })
        next()
      })
    },
  }
  return { plugin, responses }
}

test.runIf(provider.name === 'playwright')(
  'tester iframes reuse cached modules during the run',
  async () => {
    const { plugin, responses } = recordSharedModuleResponses()
    const { stderr } = await runBrowserTests(
      {
        root: './fixtures/run-module-cache',
        fileParallelism: false,
      },
      undefined,
      { plugins: [plugin] },
    )

    expect(stderr).toReportNoErrors()
    // the second test file takes the module from the cache, so each browser requests it once
    expect(responses).toEqual(
      instances.map(() => ({ status: 200, cacheControl: 'private,max-age=31536000' })),
    )
  },
)

test.runIf(provider.name === 'playwright')(
  'modules are revalidated when mocks are served by request interception',
  async () => {
    const { plugin, responses } = recordSharedModuleResponses()
    const { stderr } = await runBrowserTests(
      {
        root: './fixtures/run-module-cache',
        fileParallelism: false,
        browser: { importMapMocks: false },
      },
      undefined,
      { plugins: [plugin] },
    )

    expect(stderr).toReportNoErrors()
    // the second test file revalidates the module
    expect(responses).toEqual(
      instances.flatMap(() => [{ status: 200, cacheControl: 'no-cache' }, { status: 304 }]),
    )
  },
)
