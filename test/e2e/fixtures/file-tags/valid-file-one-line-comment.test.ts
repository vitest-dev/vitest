// @module-tag file
// @module-tag file-2
// @module-tag file/slash

import { describe, test } from 'vitest'

describe('suite 1', () => {
  test('test 1', { tags: ['test'] }, () => {})
})
