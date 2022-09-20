import { resolve } from 'pathe'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

describe('json reporter', async () => {
  const root = resolve(__dirname, '../fixtures')

  const skip = (process.platform === 'win32' || process.platform === 'darwin') && process.env.CI

  it.skipIf(skip)('generates correct report', async () => {
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

    expect(data.testResults).toHaveLength(1)
    expect(data.testResults[0].assertionResults).toHaveLength(1)

    const result = data.testResults[0].assertionResults[0]
    delete result.duration
    expect(result).toMatchSnapshot()
  }, 40000)
})
