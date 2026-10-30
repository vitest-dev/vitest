import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runInlineTests, runVitest, ts } from '../../test-utils'

it('should fail', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/global-setup-fail')
  const { stderr } = await runVitest({ root })

  expect(stderr).toBeTruthy()
  const msg = String(stderr)
    .split(/\n/g)
    .reverse()
    .find((i) => i.includes('Error: '))
    ?.trim()
  expect(msg).toBe('Error: error')
  expect(stderr).not.toContain('__vite_ssr_export_default__')
  expect(stderr).toContain('globalSetup/error.ts:6:9')
})

it('fails with a non-zero exit code when teardown throws', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/global-setup-teardown-fail')
  const { stderr, exitCode } = await runVitest({ root })

  expect(exitCode).toBe(1)
  expect(stderr).toContain('Error: teardown error')
})

it('runs global setup/teardown', async () => {
  const { stderr, errorTree } = await runVitest({
    root: './fixtures/global-setup',
    config: false,
    globalSetup: [
      './globalSetup/default-export.js',
      './globalSetup/named-exports.js',
      './globalSetup/ts-with-imports.ts',
      './globalSetup/another-vite-instance.ts',
      './globalSetup/update-env.ts',
    ],
    $viteConfig: {
      plugins: [
        {
          name: 'a-vitest-plugin-that-changes-config',
          config: () => ({
            test: {
              setupFiles: [
                './setupFiles/add-something-to-global.ts',
                'setupFiles/without-relative-path-prefix.ts',
              ],
            },
          }),
        },
      ],
    },
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "test/global-setup.test.ts": {
        "server running": "passed",
        "vite instance running": "passed",
      },
      "test/setup-files.test.ts": {
        "setup file has been loaded without relative path prefix": "passed",
        "something has been added to global by setupFiles entry": "passed",
        "the process.env is injected correctly": "passed",
      },
    }
  `)
})

it('respects root', async () => {
  const config = resolve(import.meta.dirname, '../fixtures/global-setup-root/vitest.config.ts')
  const { stderr } = await runVitest({ config })

  expect(stderr).toBe('')
})

describe('browser instances', () => {
  const globalSetup = ts`
    import { appendFileSync } from 'node:fs'
    import { resolve } from 'node:path'

    export default function setup(project) {
      const name = project.name || '<root>'
      const log = (event) => {
        appendFileSync(resolve(project.config.root, 'global-setup.log'), event + ' ' + name + '\n')
      }
      log('setup')
      project.provide('setupProject', name)
      project.onTestsRerun(() => log('rerun'))
      return () => log('teardown')
    }
  `

  const injectTest = (expected: string) => ts`
    import { expect, inject, test } from 'vitest'

    test('injects the value provided by the global setup', () => {
      expect(inject('setupProject')).toBe('${expected}')
    })
  `

  it('runs the root global setup once', async () => {
    const { ctx, vitest, errorTree, fs } = await runInlineTests(
      {
        'global-setup.js': globalSetup,
        'basic.test.js': injectTest('<root>'),
        'vitest.config.js': ts`
          import { playwright } from '@vitest/browser-playwright'
          import { defineConfig } from 'vitest/config'

          export default defineConfig({
            test: {
              globalSetup: './global-setup.js',
              browser: {
                enabled: true,
                headless: true,
                provider: playwright(),
                instances: [
                  { browser: 'chromium', name: 'chromium-1' },
                  { browser: 'chromium', name: 'chromium-2' },
                ],
              },
            },
          })
        `,
      },
      { watch: true },
    )

    await ctx!.rerunTestSpecifications(
      ctx!.state.getTestModules().map((testModule) => testModule.toTestSpecification()),
    )
    await ctx!.close()

    expect(vitest.stderr).toBe('')
    expect(errorTree({ project: true })).toMatchInlineSnapshot(`
      {
        "chromium-1": {
          "basic.test.js": {
            "injects the value provided by the global setup": "passed",
          },
        },
        "chromium-2": {
          "basic.test.js": {
            "injects the value provided by the global setup": "passed",
          },
        },
      }
    `)
    expect(fs.readFile('global-setup.log')).toMatchInlineSnapshot(`
      "setup <root>
      rerun <root>
      teardown <root>
      "
    `)
  })

  it('runs the global setup of the project that declares the instances once', async () => {
    const { stderr, errorTree, fs } = await runInlineTests({
      'global-setup.js': globalSetup,
      'instance-setup.js': ts`
        import { appendFileSync } from 'node:fs'
        import { resolve } from 'node:path'

        export default function setup(project) {
          appendFileSync(resolve(project.config.root, 'global-setup.log'), 'instance setup ' + project.name + '\n')
        }
      `,
      'basic.test.js': injectTest('app'),
      'vitest.config.js': ts`
        import { playwright } from '@vitest/browser-playwright'
        import { defineConfig } from 'vitest/config'

        export default defineConfig({
          test: {
            globalSetup: './global-setup.js',
            projects: [
              {
                test: {
                  name: 'app',
                  globalSetup: './global-setup.js',
                  browser: {
                    enabled: true,
                    headless: true,
                    provider: playwright(),
                    instances: [
                      { browser: 'chromium', name: 'chromium-1', globalSetup: './instance-setup.js' },
                      { browser: 'chromium', name: 'chromium-2' },
                    ],
                  },
                },
              },
            ],
          },
        })
      `,
    })

    expect(stderr).toBe('')
    expect(errorTree({ project: true })).toMatchInlineSnapshot(`
      {
        "chromium-1": {
          "basic.test.js": {
            "injects the value provided by the global setup": "passed",
          },
        },
        "chromium-2": {
          "basic.test.js": {
            "injects the value provided by the global setup": "passed",
          },
        },
      }
    `)
    expect(fs.readFile('global-setup.log')).toMatchInlineSnapshot(`
      "setup app
      instance setup chromium-1
      setup <root>
      teardown <root>
      teardown app
      "
    `)
  })
})
