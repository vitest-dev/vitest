// @ts-expect-error aliased to ../src/aliased-mod.ts
import { isAliased } from 'test-alias'
import { expect, test } from 'vitest'

test('check that test.alias works', () => {
  expect(isAliased).toBe(true)
})
