import type { TestCase } from 'vitest/node'
import { resolve } from 'pathe'

import { glob } from 'tinyglobby'
import { expect, it } from 'vitest'
import { runInlineTests, runVitest, ts } from '../../test-utils'

const root = resolve(__dirname, '../fixtures/fails')
const files = await glob(['**/*.test.ts'], { cwd: root, dot: true, expandDirectories: false })

it.each(files)('should fail %s', async (file) => {
  const { stderr } = await runVitest({
    root,
    update: file === 'inline-snapshop-inside-loop.test.ts' ? true : undefined,
  }, [file])

  expect(stderr).toBeTruthy()
  const msg = String(stderr)
    .split(/\n/g)
    .reverse()
    .filter(i => i.includes('Error: ') && !i.includes('Command failed') && !i.includes('stackStr') && !i.includes('at runTest') && !i.includes('at runWithTimeout') && !i.includes('file:'))
    .map(i => i.trim().replace(root, '<rootDir>'),
    )
    .join('\n')
  expect(msg).toMatchSnapshot()
}, 30_000)

it('should report coverage when "coverage.reportOnFailure: true" and tests fail', async () => {
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

it('should not report coverage when "coverage.reportOnFailure" has default value and tests fail', async () => {
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

it('prints a warning if the assertion is not awaited', async () => {
  const { stderr, results, root } = await runInlineTests({
    'base.test.js': ts`
    import { expect, test } from 'vitest';

    test('single not awaited', () => {
      expect(Promise.resolve(1)).resolves.toBe(1)
    })

    test('several not awaited', () => {
      expect(Promise.resolve(1)).resolves.toBe(1)
      expect(Promise.reject(1)).rejects.toBe(1)
    })

    test('not awaited and failed', () => {
      expect(Promise.resolve(1)).resolves.toBe(1)
      expect(1).toBe(2)
    })

    test('toMatchSnapshot not awaited', () => {
      expect(1).toMatchFileSnapshot('./snapshot.txt')
    })
    `,
  })
  expect(results[0].children.size).toEqual(4)
  const failedTest = results[0].children.at(2) as TestCase
  expect(failedTest.result()).toEqual({
    state: 'failed',
    errors: [
      expect.objectContaining({
        message: expect.stringContaining('expected 1 to be 2'),
      }),
    ],
  })
  const warnings: string[] = []
  const lines = stderr.split('\n')
  lines.forEach((line, index) => {
    if (line.includes('Promise returned by')) {
      warnings.push(lines.slice(index, index + 2).join('\n').replace(`${root}/`, '<rootDir>/'))
    }
  })
  expect(warnings).toMatchInlineSnapshot(`
    [
      "Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. Please remember to await the assertion.
        at <rootDir>/base.test.js:5:33",
      "Promise returned by \`expect(actual).rejects.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. Please remember to await the assertion.
        at <rootDir>/base.test.js:10:32",
      "Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. Please remember to await the assertion.
        at <rootDir>/base.test.js:9:33",
      "Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. Please remember to await the assertion.
        at <rootDir>/base.test.js:14:33",
      "Promise returned by \`expect(actual).toMatchFileSnapshot(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in Vitest 3. Please remember to await the assertion.
        at <rootDir>/base.test.js:19:17",
    ]
  `)
})

it('prints a warning if the assertion is not awaited in the browser mode', async () => {
  const { stderr } = await runInlineTests({
    './vitest.config.js': {
      test: {
        browser: {
          enabled: true,
          name: 'chromium',
          provider: 'playwright',
          headless: true,
        },
      },
    },
    'base.test.js': ts`
    import { expect, test } from 'vitest';

    test('single not awaited', () => {
      expect(Promise.resolve(1)).resolves.toBe(1)
    })
    `,
  })
  expect(stderr).toContain('Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited')
  expect(stderr).toContain('base.test.js:5:33')
})
