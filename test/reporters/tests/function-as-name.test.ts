import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('should print function name', async () => {
  const filename = resolve('./fixtures/function-as-name.test.ts')
  const { stdout } = await runVitest({ root: './fixtures' }, [filename])

  expect(stdout).toBeTruthy()
  expect(stdout).toContain('function-as-name.test.ts > foo > Bar')
  expect(stdout).toContain('function-as-name.test.ts > Bar > foo')
  expect(stdout).toContain('function-as-name.test.ts > <anonymous> > foo')
  expect(stdout).toContain('function-as-name.test.ts > foo > <anonymous>')
  expect(stdout).toContain('function-as-name.test.ts > foo > foo')
  expect(stdout).toContain('function-as-name.test.ts > Bar > Bar')
})

test('should print function name in benchmark', async () => {
  const filename = resolve('./fixtures/function-as-name.bench.ts')
  const { stdout } = await runVitest({ root: './fixtures' }, [filename], 'benchmark')

  expect(stdout).toBeTruthy()
  expect(stdout).toContain('Bar')
  expect(stdout).toContain('foo')
  expect(stdout).toContain('<anonymous>')
})
