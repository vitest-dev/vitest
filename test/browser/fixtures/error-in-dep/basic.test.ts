import { throwDepError } from 'test-dep-error'
import { test } from 'vitest'

test('fail', () => {
  throwDepError()
})
