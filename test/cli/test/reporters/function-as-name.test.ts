import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('should print function name', async () => {
  const filename = resolve('./fixtures/reporters/function-as-name.test.ts')
  const { stdout } = await runVitest({ root: './fixtures/reporters' }, [filename])

  expect(stdout).toBeTruthy()
  expect(stdout).toContain('function-as-name.test.ts > foo > Bar')
  expect(stdout).toContain('function-as-name.test.ts > Bar > foo')
  expect(stdout).toContain('function-as-name.test.ts > <anonymous> > foo')
  expect(stdout).toContain('function-as-name.test.ts > foo > <anonymous>')
  expect(stdout).toContain('function-as-name.test.ts > foo > foo')
  expect(stdout).toContain('function-as-name.test.ts > Bar > Bar')
})

test('should print function name in benchmark', async () => {
  const filename = resolve('./fixtures/reporters/function-as-name.bench.ts')
  const { stdout } = await runVitest({ root: './fixtures/reporters' }, [filename], { mode: 'benchmark' })

  expect(stdout).toBeTruthy()
  expect(stdout).toContain('Bar')
  expect(stdout).toContain('foo')
  expect(stdout).toContain('<anonymous>')
})
