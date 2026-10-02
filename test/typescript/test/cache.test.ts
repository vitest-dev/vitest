import { readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('the results of typecheck and runtime tests of the same file are stored separately', async () => {
  const { ctx } = await runInlineTests(
    {
      // the type assertion fails only in the typecheck run
      'basic.check.ts': /* ts */ `
        import { expectTypeOf, test } from 'vitest'
        test('number is a string', () => {
          expectTypeOf(1).toBeString()
        })
      `,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          skipLibCheck: true,
        },
        include: ['*.check.ts'],
      }),
    },
    {
      cache: true,
      include: ['*.check.ts'],
      typecheck: { enabled: true, include: ['*.check.ts'] },
    },
  )

  const results = JSON.parse(
    readFileSync(resolve(ctx!.viteConfig.cacheDir, 'results.json'), 'utf-8'),
    // durations and timestamps are different in every run
    (key, value) => (key === 'duration' || key === 'lastRun' ? `<${key}>` : value),
  )
  expect(results).toMatchInlineSnapshot(`
    {
      "projects": {
        "": {
          "files": {
            "basic.check.ts": {
              "duration": "<duration>",
              "failed": false,
              "lastRun": "<lastRun>",
            },
          },
          "typecheck": {
            "basic.check.ts": {
              "duration": "<duration>",
              "failed": true,
              "lastRun": "<lastRun>",
            },
          },
        },
      },
      "version": 1,
    }
  `)
})
