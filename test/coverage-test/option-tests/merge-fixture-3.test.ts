import { test } from 'vitest'
import { multiply } from '../src/utils'
import { useImportEnv } from '../src/importEnv'

test('cover multiply again', () => {
  multiply(1, 2)
})

test('also cover another file', () => {
  useImportEnv()
})
