import { resolve } from 'pathe'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('json reporter', async () => {
  const root = resolve(__dirname, '../fixtures')

  // in Windows child_process is very unstable, we skip testing it
  if (process.platform === 'win32' && process.env.CI)
    return

  it('generates correct report', async () => {
    const { stdout } = await execa('npx', ['vitest', 'run', 'json-fail', '--reporter=json'], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
      stdio: 'pipe',
    }).catch(e => e)

    const data = JSON.parse(stdout)

    expect(data.testResults).toBeInstanceOf(Array)
    expect(data.testResults).toHaveLength(1)

    expect(data.testResults[0].assertionResults).toMatchSnapshot()
  }, 10000)
})
