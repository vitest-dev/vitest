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

    const { stdout, stderr } = await execa('npx', [
      'vitest',
      'typecheck',
      '--dir',
      'failing',
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
    const msg = String(stderr)
      .split(/\n/g)
      .reverse()
      .filter(i => i.includes('TypeCheckError: '))
      .join('\n')
      ?.trim()
      .replace(root, '<rootDir>')
    expect(msg).toMatchSnapshot()

    const lines = stdout.split(/\n/g)

    files.forEach((file) => {
      const index = lines.findIndex(val => val.includes(`${file}:`))
      const msg = lines.slice(index, index + 8).join('\n')
      expect(msg).toMatchSnapshot(file)
    })
  }, 30_000)
})
