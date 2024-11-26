import { test } from 'vitest'
import { attest } from '@ark/attest'

test('basic', () => {
  attest<number>(1 + 2)
})
