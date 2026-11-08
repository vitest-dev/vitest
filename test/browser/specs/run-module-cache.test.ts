import type { Plugin } from 'vite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { playwright } from '@vitest/browser-playwright'
import { join } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { createFile, useTmpFS } from '../../test-utils'
import { instances, provider, runBrowserTests, runInlineBrowserTests } from './utils'

const CACHED = 'private,max-age=31536000'

function recordResponses(matches: (pathname: string) => boolean = (path) => path === '/shared.ts') {
  const responses: { status: number; cacheControl?: string }[] = []
  const plugin: Plugin = {
    name: 'record-responses',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.on('finish', () => {
          if (req.url && matches(new URL(req.url, 'http://localhost').pathname)) {
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

const sharedModuleTests = {
  'shared.ts': `export const value = 'shared'`,
  'first.test.ts': `
    import { expect, test } from 'vitest'
    import { value } from './shared'
    test('imports the shared module', () => {
      expect(value).toBe('shared')
    })
  `,
  'second.test.ts': `
    import { expect, test } from 'vitest'
    import { value } from './shared'
    test('imports the shared module', () => {
      expect(value).toBe('shared')
    })
  `,
}

test.runIf(provider.name === 'playwright')(
  'tester iframes reuse cached modules during the run',
  async () => {
    const { plugin, responses } = recordResponses()
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
    expect(responses).toEqual(instances.map(() => ({ status: 200, cacheControl: CACHED })))
  },
)

test.runIf(provider.name === 'playwright')(
  'modules are revalidated when mocks are served by request interception',
  async () => {
    const { plugin, responses } = recordResponses()
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
    const { plugin, responses } = recordResponses()
    const { stderr } = await runInlineBrowserTests(sharedModuleTests, {
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
    })

    expect(stderr).toReportNoErrors()
    // the instances run one after another: the first one caches the module before the
    // second one starts, and the second one revalidates it in its own browser
    expect(responses).toEqual([
      { status: 200, cacheControl: CACHED },
      { status: 200, cacheControl: 'no-cache' },
      { status: 304 },
    ])
  },
)

test.runIf(provider.name === 'playwright')(
  'a persistent context of any instance keeps modules revalidated',
  async () => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'vitest-run-module-cache-'))
    onTestFinished(() => rmSync(userDataDir, { recursive: true, force: true }))
    const { plugin, responses } = recordResponses()
    const { stderr } = await runInlineBrowserTests(sharedModuleTests, {
      fileParallelism: false,
      browser: {
        instances: [
          { ...instances[0], name: 'a', provider: playwright() },
          // its cache would keep the modules for the next `vitest run`
          { ...instances[0], name: 'b', provider: playwright({ persistentContext: userDataDir }) },
        ],
      },
      $viteConfig: { plugins: [plugin] },
    })

    expect(stderr).toReportNoErrors()
    expect(responses.length).toBeGreaterThan(0)
    expect(responses.filter((response) => response.cacheControl === CACHED)).toEqual([])
  },
)

test.runIf(provider.name === 'playwright')(
  'the shims of factory mocks are revalidated',
  async () => {
    const { plugin, responses } = recordResponses((path) =>
      path.includes('/@id/__x00__vitest-mock:'),
    )
    const testFile = (name: string) => `
      import { expect, test, vi } from 'vitest'
      import { value } from './dep'
      vi.mock('./dep', () => ({ value: '${name}' }))
      test('imports the mock', () => {
        expect(value).toBe('${name}')
      })
    `
    const { stderr } = await runInlineBrowserTests(
      {
        'dep.ts': `export const value = 'dep'`,
        'first.test.ts': testFile('first'),
        'second.test.ts': testFile('second'),
      },
      {
        fileParallelism: false,
        browser: { instances: [instances[0]] },
        $viteConfig: { plugins: [plugin] },
      },
    )

    expect(stderr).toReportNoErrors()
    // the shim takes its exports from the factory of the current test file
    expect(responses.length).toBeGreaterThan(0)
    expect(responses.filter((response) => response.cacheControl === CACHED)).toEqual([])
  },
)

test.runIf(provider.name === 'playwright')(
  'modules are revalidated when orchestrator scripts are used',
  async () => {
    const { plugin, responses } = recordResponses()
    const { stderr } = await runInlineBrowserTests(sharedModuleTests, {
      fileParallelism: false,
      browser: {
        instances: [instances[0]],
        // orchestrator scripts can import modules before a project reports how it mocks
        orchestratorScripts: [{ content: 'globalThis.__orchestratorScript = true' }],
      },
      $viteConfig: { plugins: [plugin] },
    })

    expect(stderr).toReportNoErrors()
    expect(responses).toEqual([{ status: 200, cacheControl: 'no-cache' }, { status: 304 }])
  },
)

test.runIf(provider.name === 'playwright')(
  'an invalidated module is read again on the next run',
  async () => {
    const { root } = useTmpFS({
      'value.ts': `export const value = 'before'`,
      'basic.test.ts': `
        import { test, vi } from 'vitest'
        import { value } from './value'
        test('logs the value', async () => {
          const actual = await vi.importActual('./value')
          console.log(\`value: \${value}, actual: \${actual.value}\`)
        })
      `,
    })
    const values: string[] = []
    const vitest = await createVitest('test', {
      root,
      watch: false,
      reporters: [
        {
          onUserConsoleLog(log) {
            values.push(log.content.trim())
          },
        },
      ],
      browser: { enabled: true, headless: true, provider, instances: [instances[0]] },
    })
    onTestFinished(() => vitest.close())

    await vitest.start()
    createFile(join(root, 'value.ts'), `export const value = 'after'`)
    vitest.invalidateFile(join(root, 'value.ts'))
    await vitest.rerunFiles()

    // the browser context of the first run has the old module in its cache
    expect(values).toEqual(['value: before, actual: before', 'value: after, actual: after'])
  },
)
