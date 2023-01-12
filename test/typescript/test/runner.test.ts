import { resolve } from 'pathe'
import fg from 'fast-glob'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('should fails', async () => {
  const root = resolve(__dirname, '../failing')
  const files = await fg('*.test-d.*', { cwd: root })

  it('typecheck files', async () => {
    // in Windows child_process is very unstable, we skip testing it
    if (process.platform === 'win32' && process.env.CI)
      return

    const { stderr } = await execa('npx', [
      'vitest',
      'typecheck',
      '--dir',
      resolve(__dirname, '..', './failing'),
      '--config',
      resolve(__dirname, './vitest.config.ts'),
    ], {
      cwd: root,
      reject: false,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
    })

    expect(stderr).toBeTruthy()
    const lines = String(stderr).split(/\n/g)
    const msg = lines
      .filter(i => i.includes('TypeCheckError: '))
      .reverse()
      .join('\n')
      .trim()
      .replace(root, '<rootDir>')
    expect(stderr).not.toMatch('files found, exiting with code')
    expect(msg).toMatchSnapshot()

    files.forEach((file) => {
      expect(String(stderr)).toMatch(`${file}:`)
    })

    lines.forEach((line, idx) => {
      if (line.includes('TypeCheckError')) {
        const msg = lines.slice(idx - 1, idx + 7).join('\n')
        expect(msg).toMatchSnapshot()
      }
    })
  }, 30_000)
})
