import { runInlineTests } from '#test-utils'
import { describe, expect, test } from 'vitest'

const ts = String.raw

const fixture = {
  'math.test.ts': ts`
    import { expect, test } from 'vitest'
    import { sum } from './math'

    test('sum', () => {
      expect(sum(1, 2)).toBe(3)
    })
  `,
  'math.ts': ts`
    export function sum(a: number, b: number) {
      return a + b
    }
  `,
  'basic.test.ts': ts`
    import { test } from 'vitest'

    test('basic', () => {})
  `,
}

describe.each([true, false])('standalone mode is %s', (standalone) => {
  test('quit watch mode', async () => {
    const { vitest, waitForClose } = await runInlineTests(fixture, { watch: true, standalone })

    vitest.write('q')

    await waitForClose()
  })

  test('filter by filename', async () => {
    const { vitest } = await runInlineTests(fixture, { watch: true, standalone })

    vitest.write('p')

    await vitest.waitForStdout('Input filename pattern')

    vitest.write('math')

    await vitest.waitForStdout('Pattern matches 1 result')
    await vitest.waitForStdout('› math.test.ts')

    vitest.write('\n')

    await vitest.waitForStdout('Filename pattern: math')
    await vitest.waitForStdout('1 passed')
  })

  test('filter by filename when multiple projects match same file', async () => {
    const { vitest } = await runInlineTests(fixture, {
      watch: true,
      standalone,
      projects: [
        {
          test: {
            name: 'First',
          },
        },
        {
          test: {
            name: 'Second',
          },
        },
      ],
    })

    vitest.write('p')

    await vitest.waitForStdout('Input filename pattern')

    vitest.write('math')

    await vitest.waitForStdout('Pattern matches 1 result')
    await vitest.waitForStdout('› math.test.ts')

    vitest.write('\n')

    // 2 due to count of projects
    await vitest.waitForStdout('2 passed')
    await vitest.waitForStdout('Filename pattern: math')
  })

  test('filter by test name', async () => {
    const { vitest } = await runInlineTests(fixture, { watch: true, standalone })

    vitest.write('t')

    await vitest.waitForStdout('Input test name pattern')

    vitest.write('sum')
    if (standalone) {
      await vitest.waitForStdout('Pattern matches no results')
    }
    else {
      await vitest.waitForStdout('Pattern matches 1 result')
    }
    await vitest.waitForStdout('› sum')

    vitest.write('\n')

    await vitest.waitForStdout('Test name pattern: /sum/')
    await vitest.waitForStdout('1 passed')
  })

  test.skipIf(process.env.GITHUB_ACTIONS)('cancel test run', async () => {
    const { fs, vitest } = await runInlineTests(fixture, { watch: true, standalone })

    const testCase = ts`
      // Dynamic test case
      import { afterAll, afterEach, test } from 'vitest'

      // These should be called even when test is cancelled
      afterAll(() => console.log('[cancel-test]: afterAll'))
      afterEach(() => console.log('[cancel-test]: afterEach'))

      test('1 - test that finishes', async () => {
        console.log('[cancel-test]: test')

        await new Promise(resolve => setTimeout(resolve, 1000))
      })

      test('2 - test that is cancelled', async () => {
        console.log('[cancel-test]: should not run')
      })
    `

    fs.createFile('cancel.test.ts', testCase)

    // Test case is running, cancel it
    await vitest.waitForStdout('[cancel-test]: test')
    vitest.write('c')

    // Test hooks should still be called
    await vitest.waitForStdout('CANCELLED')
    await vitest.waitForStdout('[cancel-test]: afterAll')
    await vitest.waitForStdout('[cancel-test]: afterEach')

    expect(vitest.stdout).not.include('[cancel-test]: should not run')
  })
})

test('rerun current pattern tests', async () => {
  const { vitest } = await runInlineTests(fixture, { watch: true, testNamePattern: 'sum' })

  vitest.write('r')

  await vitest.waitForStdout('RERUN')
  await vitest.waitForStdout('Test name pattern: /sum/')
  await vitest.waitForStdout('1 passed')
})

test('cli filter as watch filename pattern', async () => {
  const { vitest } = await runInlineTests(fixture, { watch: true, $cliFilters: ['math'] })

  vitest.write('r')

  await vitest.waitForStdout('RERUN')
  await vitest.waitForStdout('Filename pattern: math')
  await vitest.waitForStdout('1 passed')
})
