// @vitest-environment jsdom

import { expect, test } from 'vitest'
import { getNodeEnv } from '../src/process-env'

test('process.env works', () => {
  expect(getNodeEnv()).toBe('test')
})
