import { expect, test } from 'vitest'
import { getVirtualFileImports} from '../src/virtual-files'

test("verify virtual files work", () => {
  const {virtualFile1, virtualFile2} = getVirtualFileImports()

  expect(virtualFile1).toBe('This file should be excluded from coverage report #1')
  expect(virtualFile2).toBe('This file should be excluded from coverage report #2')

})