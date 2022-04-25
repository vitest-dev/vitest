import fs from 'fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('coverage', async () => {
  const coveragePath = resolve('./coverage/tmp/')
  const stat = fs.statSync(coveragePath)
  expect(stat.isDirectory()).toBe(true)
  const files = fs.readdirSync(coveragePath)
  expect(files.length > 0).toBe(true)
})
