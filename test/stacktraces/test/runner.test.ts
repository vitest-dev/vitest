import { resolve } from 'pathe'
import fg from 'fast-glob'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('stacktraces should respect sourcemaps', async () => {
  const root = resolve(__dirname, '../fixtures')
  const files = await fg('*.test.*', { cwd: root })

  for (const file of files) {
    it(file, async () => {
      // in Windows child_process is very unstable, we skip testing it
      if (process.platform === 'win32' && process.env.CI)
        return

      let error: any
      await execa('npx', ['vitest', 'run', file], {
        cwd: root,
        env: {
          ...process.env,
          CI: 'true',
          NO_COLOR: 'true',
        },
      })
        .catch((e) => {
          error = e
        })

      expect(error).toBeTruthy()
      const lines = String(error).split(/\n/g)
      const index = lines.findIndex(val => val.includes(`${file}:`))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot(file)
    }, 30000)
  }
})

describe('stacktraces should pick error frame if present', async () => {
  const root = resolve(__dirname, '../fixtures')
  const files = ['frame.spec.imba']

  for (const file of files) {
    it(file, async () => {
    // in Windows child_process is very unstable, we skip testing it
      if (process.platform === 'win32' && process.env.CI)
        return

      let error: any
      await execa('npx', ['vitest', 'run', file], {
        cwd: root,
        env: {
          ...process.env,
          CI: 'true',
          NO_COLOR: 'true',
        },
      })
        .catch((e) => {
          error = e
        })

      expect(error).toBeTruthy()
      const lines = String(error).split(/\n/g)
      const index = lines.findIndex(val => val.includes(`${file}:`))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot(file)
    }, 30000)
  }
})
