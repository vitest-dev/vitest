import { resolve } from 'pathe'
import fg from 'fast-glob'
import { expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

const root = resolve(__dirname, '../fixtures')
const files = await fg('**/*.test.ts', { cwd: root, dot: true })
const emptyTestFile = await fg('**/empty.test.ts', { cwd: root, dot: true })
const emptySuiteTestFile = await fg('**/empty-suite.test.ts', { cwd: root, dot: true })

it.each(files)('should fail %s', async (file) => {
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

it.each(emptyTestFile.concat(emptySuiteTestFile))('should pass %s when passWithNoTests enabled', async (file) => {
  const { stdout, stderr, exitCode } = await runVitest({
    root,
    passWithNoTests: true,
  }, [file])

  expect(exitCode).toBe(0)
})

it('should report coverage when "coverag.reportOnFailure: true" and tests fail', async () => {
  const { stdout } = await runVitest({
    root,
    coverage: {
      enabled: true,
      provider: 'istanbul',
      reportOnFailure: true,
      reporter: ['text'],
    },
  }, [files[0]])

  expect(stdout).toMatch('Coverage report from istanbul')
})

it('should not report coverage when "coverag.reportOnFailure" has default value and tests fail', async () => {
  const { stdout } = await runVitest({
    root,
    coverage: {
      enabled: true,
      provider: 'istanbul',
      reporter: ['text'],
    },
  }, [files[0]])

  expect(stdout).not.toMatch('Coverage report from istanbul')
})
