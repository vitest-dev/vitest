import fs from 'fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { pythagoras } from '../src'

test('Math.sqrt()', async() => {
  expect(pythagoras(3, 4)).toBe(5)
})

test('coverage', async() => {
  const stat = fs.statSync(resolve('./coverage/'))
  expect(stat.isDirectory()).toBe(true)
})
