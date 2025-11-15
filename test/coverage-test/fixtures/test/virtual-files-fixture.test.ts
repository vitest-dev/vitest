import { expect, test } from 'vitest'
import { getVirtualFileImports} from '../src/virtual-files'

test("verify virtual files work", () => {
  const {virtualFile1, virtualFile2, virtualMath} = getVirtualFileImports()

  expect(virtualFile1).toBe('This file should be excluded from coverage report #1')
  expect(virtualFile2).toBe('This file should be excluded from coverage report #2')

  expect(virtualMath).toHaveProperty('sum')
  expect(virtualMath.sum(50, 65)).toBe(115)
})
