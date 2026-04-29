// @module-tag invalid
// @module-tag unknown

import { describe, test } from 'vitest'

describe('suite 1', () => {
  test('test 1', { tags: ['test'] }, () => {})
})
