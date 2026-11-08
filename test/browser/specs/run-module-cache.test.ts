import type { Plugin } from 'vite'
import { playwright } from '@vitest/browser-playwright'
import { expect, test } from 'vitest'
import { instances, provider, runBrowserTests, runInlineBrowserTests } from './utils'

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

test.runIf(provider.name === 'playwright' && instances.some((i) => i.browser === 'firefox'))(
  'an instance that has not started yet keeps the cache for the other instances',
  async () => {
    const { plugin, responses } = recordSharedModuleResponses()
    const testFile = `
      import { expect, test } from 'vitest'
      import { value } from './shared'
      test('imports the shared module', () => {
        expect(value).toBe('shared')
      })
    `
    const { stderr } = await runInlineBrowserTests(
      {
        'shared.ts': `export const value = 'shared'`,
        'first.test.ts': testFile,
        'second.test.ts': testFile,
      },
      {
        fileParallelism: false,
        browser: {
          instances: [
            { browser: 'firefox', name: 'a-import-map' },
            {
              browser: 'firefox',
              name: 'b-interception',
              // without late import maps, mocks are served by request interception
              provider: playwright({
                launchOptions: {
                  firefoxUserPrefs: { 'dom.multiple_import_maps.enabled': false },
                },
              }),
            },
          ],
        },
        $viteConfig: { plugins: [plugin] },
      },
    )

    expect(stderr).toReportNoErrors()
    // the instances run one after another: the first one caches the module before the
    // second one starts, and the second one revalidates it in its own browser
    expect(responses).toEqual([
      { status: 200, cacheControl: 'private,max-age=31536000' },
      { status: 200, cacheControl: 'no-cache' },
      { status: 304 },
    ])
  },
)
