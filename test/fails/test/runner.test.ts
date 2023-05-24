import { resolve } from 'pathe'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

describe('should fails', async () => {
  const root = resolve(__dirname, '../fixtures')
  const files = await fg('**/*.test.ts', { cwd: root, dot: true })

  for (const file of files) {
    it(file, async () => {
      const { stderr } = await runVitest({ root }, [file])

      expect(stderr).toBeTruthy()
      const msg = String(stderr)
        .split(/\n/g)
        .reverse()
        .filter(i => i.includes('Error: ') && !i.includes('Command failed') && !i.includes('stackStr') && !i.includes('at runTest'))
        .map(i => i.trim().replace(root, '<rootDir>'),
        ).join('\n')
      expect(msg).toMatchSnapshot(file)
    }, 30_000)
  }
})
