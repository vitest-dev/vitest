import { test } from 'vitest'
import { add } from './foo'

test('error in deps', () => {
  add()
})
