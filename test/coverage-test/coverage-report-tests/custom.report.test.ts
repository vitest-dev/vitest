/*
 * Custom coverage provider specific test cases
 */

import { readFileSync } from 'fs'
import { expect, test } from 'vitest'

test('custom json report', async () => {
  const report = readFileSync('./coverage/custom-coverage-provider-report.json', 'utf-8')

  expect(JSON.parse(report)).toMatchSnapshot()
})
