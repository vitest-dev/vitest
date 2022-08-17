import { expect, it, vitest } from 'vitest'

import { sub } from '@vitest/test-path-resolution-target'

vitest.mock('@vitest/test-path-resolution-target')

it('should be mocked', () => {
  expect(sub).toHaveProperty('mock')
  expect(sub(5, 3)).toBeUndefined()
})

it('should import actual', async () => {
  const { sub } = await vitest.importActual<typeof import('@vitest/test-path-resolution-target')>('@vitest/test-path-resolution-target')

  expect(sub).not.toHaveProperty('mock')
  expect(sub(5, 3)).toBe(2)
})
