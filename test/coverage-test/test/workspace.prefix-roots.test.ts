import { expect } from 'vitest'
import { isNativeRunner, readCoverageMap, runVitest, test } from '../utils'

test('uncovered files are transformed by the project whose root contains them', async ({
  skip,
}) => {
  skip(isNativeRunner(), 'native runner does not support plugins')

  await runVitest({
    config: './fixtures/configs/vitest.config.prefix-roots.ts',
    coverage: {
      reporter: 'json',
      include: ['**/prefix-roots/**/untested.ts'],
    },
  })

  const coverageMap = await readCoverageMap()

  const functionNames = Object.fromEntries(
    coverageMap
      .files()
      .map((file) => [
        file,
        Object.values(coverageMap.fileCoverageFor(file).fnMap).map((fn) => fn.name),
      ]),
  )

  expect(functionNames).toMatchInlineSnapshot(`
    {
      "<process-cwd>/fixtures/workspaces/prefix-roots/app-utils/src/untested.ts": [
        "transformedByAppUtils",
      ],
      "<process-cwd>/fixtures/workspaces/prefix-roots/app/src/untested.ts": [
        "transformedByApp",
      ],
    }
  `)
})
