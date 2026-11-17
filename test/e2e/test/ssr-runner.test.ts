import { version } from 'vite'
import { expect, it } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

// https://github.com/vitest-dev/vitest/issues/9324
it('ssr runner.import() works in configureServer', async () => {
  const { stderr } = await runVitest({ root: './fixtures/ssr-runner' })
  expect(stderr).toBe('')
  expect((globalThis as any).__testSsrRunner).toBe(version)
})

it('ssr runner.import() works in configureServer with a cached module', async () => {
  const firstRun = await runInlineTests({
    'vitest.config.js': /* js */ `
      import { isRunnableDevEnvironment } from 'vite'
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        plugins: [
          {
            name: 'load-routes',
            async configureServer(server) {
              const ssr = server.environments.ssr
              if (isRunnableDevEnvironment(ssr)) {
                const { routes } = await ssr.runner.import('./routes.js')
                if (routes.length !== 2) {
                  throw new Error('routes were not loaded')
                }
              }
            },
          },
        ],
        test: {
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.vitest-fs-cache',
        },
      })
    `,
    'routes.js': `export const routes = ['/', '/about']`,
    'basic.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('basic', () => {
        expect(1 + 1).toBe(2)
      })
    `,
  })
  expect(firstRun.stderr).toBe('')
  await firstRun.ctx?.close()

  const secondRun = await runVitest({ root: firstRun.root })
  expect(secondRun.stderr).toBe('')
  expect(secondRun.testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "basic": "passed",
      },
    }
  `)
})

it('works in project', async () => {
  const { stderr } = await runVitest({ root: './fixtures/ssr-runner-project' })
  expect(stderr).toBe('')
  expect((globalThis as any).__testSsrRunnerProject).toBe(version)
})
