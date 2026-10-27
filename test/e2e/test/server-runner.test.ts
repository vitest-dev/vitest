import { isRunnableDevEnvironment } from 'vite'
import { expect, test } from 'vitest'
import { replaceRoot, runInlineTests, ts } from '#test-utils'

test.each([false, true])(
  'maps stack traces in server modules (fsModuleCache: %s)',
  async (fsModuleCache) => {
    let code: unknown
    let stack = ''
    const { stderr, testTree } = await runInlineTests(
      {
        'error.ts': ts`
          export function captureStack(): string {
            return new Error('échec').stack!
          }
        `,
        'basic.test.ts': ts`
          import { test } from 'vitest'
          test('passes', () => {})
        `,
      },
      {
        fsModuleCache,
        fsModuleCachePath: './node_modules/.vitest-fs-cache',
        $viteConfig: {
          plugins: [
            {
              name: 'test-server-runner-source-map',
              async configureServer(server) {
                const environment = server.environments.ssr
                if (isRunnableDevEnvironment(environment)) {
                  const { captureStack } = await environment.runner.import<{
                    captureStack: () => string
                  }>('./error.ts')
                  const module = environment.runner.evaluatedModules.getModuleById(
                    `${server.config.root}/error.ts`,
                  )
                  code = module?.meta && 'code' in module.meta ? module.meta.code : undefined
                  stack = replaceRoot(captureStack(), server.config.root)
                    .split('\n')
                    .slice(0, 2)
                    .join('\n')
                }
              },
            },
          ],
        },
      },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "passes": "passed",
        },
      }
    `)
    expect(typeof code).toBe('string')
    expect(stack).toMatchInlineSnapshot(`
      "Error: échec
          at captureStack (<root>/error.ts:3:20)"
    `)
  },
)
