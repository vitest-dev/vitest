// @ts-expect-error not typed aliased import
import getModuleType from 'custom-lib'
import { expect, it } from 'vitest'

it('custom-lib is externalized because it\'s a valid esm file in module directory', () => {
  expect(getModuleType()).toBe('undefined')
})
