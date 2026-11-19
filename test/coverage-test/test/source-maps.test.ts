import { playwright } from '@vitest/browser-playwright'
import { expect } from 'vitest'
import { isBrowser, isNativeRunner, isV8Provider, readCoverageMap, runVitest, test } from '../utils'

test('errors point to correct location', async () => {
  const { stderr } = await runVitest(
    {
      include: ['fixtures/test/error-location.test.ts'],
      coverage: { reporter: 'json' },
    },
    { throwOnError: false },
  )

  expect(stderr).toMatch(
    `
❯ throws fixtures/src/throws-error.ts:29:12
     27|    */
     28|    function throws() {
     29|      throw new Error("Expected error")
       |            ^
     30|    }
    `.trim(),
  )
})

test('statements are merged when environments produce different end mappings (#9366, #11921)', async ({
  skip,
}) => {
  skip(isBrowser(), 'test defines its own browser project')
  skip(isNativeRunner(), 'v8 provider already covered')

  await runVitest({
    coverage: {
      reporter: 'json',
      include: ['fixtures/src/end-mapping.ts'],
    },
    projects: [
      {
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['fixtures/test/end-mapping-fixture.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['fixtures/test/end-mapping-fixture.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor('<process-cwd>/fixtures/src/end-mapping.ts')

  const statements = Object.entries(fileCoverage.statementMap).map(
    ([id, { start, end }]) =>
      `${start.line}:${start.column} - ${end.line}:${end.column} = ${fileCoverage.s[id]}`,
  )

  // Each statement should be reported once, with hits from both projects.
  if (isV8Provider()) {
    expect(statements).toMatchInlineSnapshot(`
      [
        "4:20 - 4:29 = 2",
        "5:2 - 5:null = 2",
      ]
    `)
  } else {
    expect(statements).toMatchInlineSnapshot(`
      [
        "4:20 - 4:null = 2",
        "5:2 - 5:null = 2",
      ]
    `)
  }
})
