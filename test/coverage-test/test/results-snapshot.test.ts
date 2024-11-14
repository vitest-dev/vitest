import { expect } from 'vitest'
import { isV8Provider, readCoverageJson, runVitest, test } from '../utils'

test('coverage results matches snapshot', async () => {
  await runVitest({
    include: ['fixtures/test/math.test.ts', 'fixtures/test/even.test.ts'],
    coverage: {
      reporter: 'json',
      include: [
        'fixtures/src/math.ts',
        'fixtures/src/even.ts',
        'fixtures/src/untested-file.ts',
      ],
    },
  })

  const coverageJson = await readCoverageJson()

  await expect(JSON.stringify(coverageJson, null, 2)).toMatchFileSnapshot(`__snapshots__/results-${isV8Provider() ? 'v8' : 'istanbul'}.snapshot.json`)
})
