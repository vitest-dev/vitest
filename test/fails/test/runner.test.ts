import { resolve } from 'path'
import fg from 'fast-glob'
import { execa } from 'execa'
import { describe, it, expect } from 'vitest'

describe('should fails', async() => {
  const root = resolve(__dirname, '../fixtures')
  const files = await fg('*.test.ts', { cwd: root })

  const executions = files.reduce((acc, f) => {
    acc.push([f, execa('npx', ['vitest', f], { cwd: root, env: { NO_COLOR: 'true' } })])
    return acc
  }, [] as Array<[string, Promise<any>]>)

  for (const [file, execution] of executions) {
    it(file, async() => {
      let error: any
      try {
        await execution
      }
      catch (e) {
        error = e
      }

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
