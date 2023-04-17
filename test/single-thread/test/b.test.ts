import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import { expect, it } from 'vitest'
import { timeout } from './timeout'

// this file is running second, it should not be affected by mock in "a.test.ts"
it('mock is mocked', () => {
  expect(fs.readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), './timeout.ts'), 'utf-8')).toMatchInlineSnapshot(`
    "export const timeout = 200
    export const mockedFn = function () {
      return 'original'
    }
    "
  `)
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))
