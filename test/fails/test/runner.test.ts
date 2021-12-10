import { resolve } from 'path'
import { exec } from 'child_process'
import fg from 'fast-glob'
import { describe, it, expect } from 'vitest'

describe('should fails', async() => {
  const root = resolve(__dirname, '../fixtures')
  const cli = resolve(__dirname, '../../../bin/vitest.mjs')
  const files = await fg('*.test.ts', { cwd: root })

  for (const file of files) {
    it(file, async() => {
      let error: any
      await new Promise<void>((resolve) => {
        exec(`node '${cli}' ${file}`, {
          env: {
            ...process.env,
            NO_COLOR: 'true',
          },
          cwd: root,
        }, (e) => {
          error = e
          resolve()
        })
      })

      expect(error).toBeTruthy()
      const msg = String(error)
        .split(/\n/g)
        .reverse()
        .find(i => i.includes('Error: '))
        ?.trim()
      expect(msg).toMatchSnapshot()
    })
  }
})
