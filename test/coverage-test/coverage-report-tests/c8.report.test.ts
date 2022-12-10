/*
 * C8 coverage provider specific test cases
 */

import { expect, test } from 'vitest'
import { readCoverageJson } from './utils'

test('c8 json report', async () => {
  const jsonReport = await readCoverageJson()

  // If this fails, you can use "npx live-server@1.2.1 ./coverage" to see coverage report
  expect(jsonReport).toMatchSnapshot()
})

