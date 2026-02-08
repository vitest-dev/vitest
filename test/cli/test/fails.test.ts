import { playwright } from '@vitest/browser-playwright'

import { resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { expect, it } from 'vitest'
import { runInlineTests, runVitest, ts } from '../../test-utils'

const root = resolve(import.meta.dirname, '../fixtures/fails')
const files = await glob(['**/*.test.{ts,js}'], { cwd: root, dot: true, expandDirectories: false })

it.each(files)('should fail %s', async (file) => {
  const { stderr } = await runVitest({ root }, [file])

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
  const { stderr, root, errorTree } = await runInlineTests({
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

    test('toMatchFileSnapshot not awaited', () => {
      expect(1).toMatchFileSnapshot('./snapshot.txt')
    })

    test('soft + toMatchFileSnapshot not awaited', () => {
      expect.soft(1).toMatchFileSnapshot('./snapshot-soft.txt')
    })
    `,
  }, {
    update: true,
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "base.test.js": {
        "not awaited and failed": [
          "expected 1 to be 2 // Object.is equality",
        ],
        "several not awaited": "passed",
        "single not awaited": "passed",
        "soft + toMatchFileSnapshot not awaited": "passed",
        "toMatchFileSnapshot not awaited": "passed",
      },
    }
  `)
  const warnings: string[] = []
  const lines = stderr.split('\n')
  lines.forEach((line, index) => {
    if (line.includes('Promise returned by')) {
      warnings.push(lines.slice(index, index + 2).join('\n').replace(`${root}/`, '<rootDir>/'))
    }
  })
  expect(warnings).toMatchInlineSnapshot(`
    [
      "Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in the next Vitest major. Please remember to await the assertion.
        at <rootDir>/base.test.js:5:33",
      "Promise returned by \`expect(actual).rejects.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in the next Vitest major. Please remember to await the assertion.
        at <rootDir>/base.test.js:10:32",
      "Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in the next Vitest major. Please remember to await the assertion.
        at <rootDir>/base.test.js:9:33",
      "Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in the next Vitest major. Please remember to await the assertion.
        at <rootDir>/base.test.js:14:33",
      "Promise returned by \`expect(actual).toMatchFileSnapshot(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in the next Vitest major. Please remember to await the assertion.
        at <rootDir>/base.test.js:19:17",
      "Promise returned by \`expect.soft(actual).toMatchFileSnapshot(expected)\` was not awaited. Vitest currently auto-awaits hanging assertions at the end of the test, but this will cause the test to fail in the next Vitest major. Please remember to await the assertion.
        at <rootDir>/base.test.js:23:22",
    ]
  `)
})

it('prints a warning if the assertion is not awaited in the browser mode', async () => {
  const { stderr } = await runInlineTests({
    'base.test.js': ts`
    import { expect, test } from 'vitest';

    test('single not awaited', () => {
      expect(Promise.resolve(1)).resolves.toBe(1)
    })
    `,
  }, {
    browser: {
      enabled: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright(),
      headless: true,
    },
  })
  expect(stderr).toContain('Promise returned by \`expect(actual).resolves.toBe(expected)\` was not awaited')
  expect(stderr).toContain('base.test.js:5:33')
})

it('reports test file if it failed to load', async () => {
  const hooks: string[] = []
  await runInlineTests({
    'basic.test.js': `throw new Error('fail')`,
  }, {
    reporters: [
      'default',
      {
        onTestModuleQueued(testModule) {
          hooks.push(`onTestModuleQueued:${testModule.relativeModuleId}`)
        },
        onTestModuleStart(testModule) {
          hooks.push(`onTestModuleStart:${testModule.relativeModuleId}`)
        },
        onTestModuleCollected(testModule) {
          hooks.push(`onTestModuleCollected:${testModule.relativeModuleId}`)
        },
        onTestModuleEnd(testModule) {
          hooks.push(`onTestModuleEnd:${testModule.relativeModuleId}`)
        },
      },
    ],
  })

  expect(hooks).toMatchInlineSnapshot(`
    [
      "onTestModuleQueued:basic.test.js",
      "onTestModuleCollected:basic.test.js",
      "onTestModuleStart:basic.test.js",
      "onTestModuleEnd:basic.test.js",
    ]
  `)
})

it('should warn if retry.condition is a function in config', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/retry-config',
  })

  expect(stderr).toContain('Warning: retry.condition function cannot be used inside a config file.')
})
