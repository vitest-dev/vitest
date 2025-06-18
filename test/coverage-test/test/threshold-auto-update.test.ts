import { readFileSync, writeFileSync } from 'node:fs'
import { expect, onTestFinished } from 'vitest'
import { runVitest, test } from '../utils'

const config = 'fixtures/configs/vitest.config.thresholds-auto-update.ts'

test('thresholds.autoUpdate updates thresholds', async () => {
  const original = readConfig()
  onTestFinished(() => writeFileSync(config, original))

  expect(original).toMatchInlineSnapshot(`
    "import { defineConfig } from 'vitest/config'

    export default defineConfig({
      test: {
        coverage: {
          thresholds: {
            autoUpdate: true,

            // Global ones
            lines: 0.1,
            functions: 0.2,
            branches: -1000,
            statements: -2000,

            '**/src/math.ts': {
              branches: 0.1,
              functions: 0.2,
              lines: -1000,
              statements: -2000,
            }
          }
        }
      },
    })
    "
  `)

  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    config,
  }, { throwOnError: false })

  expect(readConfig()).toMatchInlineSnapshot(`
    "import { defineConfig } from 'vitest/config'

    export default defineConfig({
      test: {
        coverage: {
          thresholds: {
            autoUpdate: true,

            // Global ones
            lines: 33.33,
            functions: 33.33,
            branches: 100,
            statements: -4,

            '**/src/math.ts': {
              branches: 100,
              functions: 25,
              lines: -3,
              statements: -3,
            }
          }
        }
      },
    })"
  `)
})

function readConfig() {
  return readFileSync(config, 'utf8')
}
