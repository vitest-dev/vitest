import { resolve } from 'pathe'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('should fails', async () => {
  const root = resolve(__dirname, '../fixtures')
  // in Windows child_process is very unstable, we skip testing it
  if (process.platform === 'win32' && process.env.CI)
    return

  it('should fails', async () => {
    const { stdout } = await execa('npx ', ['vitest', 'run', 'expect.test.ts', '--reporter=json'], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
    }).catch(e => e)

    // remove the Timestamp/Duration/test file name part from json report
    const msg = stdout
      .split(/\n/g)
      .map(line =>
        line.includes('startTime') || line.includes('endTime') || line.includes('duration') || line.includes('name') ? '' : line,
      )

    expect(msg).toMatchSnapshot()
  })
})
