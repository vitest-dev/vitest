import { resolve } from 'path'
import fg from 'fast-glob'
import { execa } from 'execa'
import { describe, it, expect } from 'vitest'

describe('should fails', async() => {
  const root = resolve(__dirname, '../fixtures')
  const files = await fg('*.test.ts', { cwd: root })

  for (const file of files) {
    it(file, async() => {
      let error: any
      try {
        await execa('npx', ['vitest', file], { cwd: root })
      }
      catch (e) {
        error = e
      }

      expect(error).toBeTruthy()
      expect(String(error).split('\n').filter(Boolean).reverse().find(i => i.includes('Error: '))).toMatchSnapshot()
    })
  }
})
