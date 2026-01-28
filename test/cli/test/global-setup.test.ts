import { resolve } from 'pathe'
import { expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

it('should fail', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/global-setup-fail')
  const { stderr } = await runVitest({ root })

  expect(stderr).toBeTruthy()
  const msg = String(stderr)
    .split(/\n/g)
    .reverse()
    .find(i => i.includes('Error: '))
    ?.trim()
  expect(msg).toBe('Error: error')
  expect(stderr).not.toContain('__vite_ssr_export_default__')
  expect(stderr).toContain('globalSetup/error.ts:6:9')
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
