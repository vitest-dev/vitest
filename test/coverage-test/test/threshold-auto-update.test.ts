import { readFileSync, writeFileSync } from 'node:fs'
import { expect, onTestFinished } from 'vitest'
import { isV8Provider, runVitest, test } from '../utils'

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
            branches: 0.3,
            statements: 0.4,

            '**/src/math.ts': {
              branches: 0.1,
              functions: 0.2,
              lines: 0.3,
              statements: 0.4
            }
          }
        }
      },
    })
    "
  `)

  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: { all: false },
    config,
  }, { throwOnError: false })

  if (isV8Provider()) {
    expect(readConfig()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vitest/config'

      export default defineConfig({
        test: {
          coverage: {
            thresholds: {
              autoUpdate: true,

              // Global ones
              lines: 55.55,
              functions: 33.33,
              branches: 100,
              statements: 55.55,

              '**/src/math.ts': {
                branches: 100,
                functions: 25,
                lines: 50,
                statements: 50
              }
            }
          }
        },
      })"
    `)
  }
  else {
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
              statements: 33.33,

              '**/src/math.ts': {
                branches: 100,
                functions: 25,
                lines: 25,
                statements: 25
              }
            }
          }
        },
      })"
    `)
  }
})

function readConfig() {
  return readFileSync(config, 'utf8')
}
