import { expect } from 'vitest'
import { readCoverageMap, runVitest, test } from '../utils'

test('import attributes work', async () => {
  await runVitest({
    include: ['fixtures/test/import-attributes-fixture.test.ts'],
    coverage: { reporter: 'json', all: false },
  })

  const coverageMap = await readCoverageMap()
  const files = coverageMap.files()

  expect(files).toMatchInlineSnapshot(`
    [
      "<process-cwd>/fixtures/src/json-data-import.ts",
    ]
  `)
})
