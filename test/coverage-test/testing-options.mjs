import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { startVitest } from 'vitest/node'

/**
 * @typedef {NonNullable<import('vitest/config').UserConfig['test']>} Config
 * @typedef { () => void | Promise<void> } Callback
 * @typedef {{ testConfig: Config, assertionConfig?: Config, after?: Callback, before?: Callback }} TestCase
 */

/** @type {TestCase[]} */
const testCases = [
  {
    testConfig: {
      name: 'allowExternal: true',
      include: ['option-tests/allow-external.test.ts'],
      coverage: {
        allowExternal: true,
        include: ['**/src/**', '**/test-utils/fixtures/**'],
        reporter: 'html',
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/allow-external.test.ts'],
      env: { VITE_COVERAGE_ALLOW_EXTERNAL: true },
    },
  },
  {
    testConfig: {
      name: 'allowExternal: false',
      include: ['option-tests/allow-external.test.ts'],
      coverage: {
        allowExternal: false,
        include: ['**/src/**', '**/test-utils/fixtures/**'],
        reporter: 'html',
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/allow-external.test.ts'],
    },
  },
  {
    testConfig: {
      name: 'thresholds.100',
      include: ['option-tests/threshold-100.test.ts'],
      coverage: {
        thresholds: {
          100: true,
        },
      },
    },
    assertionConfig: null,
  },
  {
    testConfig: {
      name: 'temp directory with shard',
      include: ['option-tests/shard.test.ts'],
      shard: '1/4',
    },
    assertionConfig: null,
  },
  {
    testConfig: {
      name: 'changed',
      changed: 'HEAD',
      coverage: {
        include: ['src'],
        reporter: 'json',
        all: true,
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/changed.test.ts'],
    },
    before: () => {
      let content = readFileSync('./src/file-to-change.ts', 'utf8')
      content = content.replace('This file will be modified by test cases', 'Changed!')
      writeFileSync('./src/file-to-change.ts', content, 'utf8')

      writeFileSync('./src/new-uncovered-file.ts', `
      // This file is not covered by any tests but should be picked by --changed
      export default function helloworld() {
        return 'Hello world'
      }
      `.trim(), 'utf8')
    },
    after: () => {
      let content = readFileSync('./src/file-to-change.ts', 'utf8')
      content = content.replace('Changed!', 'This file will be modified by test cases')
      writeFileSync('./src/file-to-change.ts', content, 'utf8')
      rmSync('./src/new-uncovered-file.ts')
    },
  },
]

for (const provider of ['v8', 'istanbul']) {
  for (const { after, before, testConfig, assertionConfig } of testCases) {
    await before?.()

    // Run test case
    await startVitest('test', ['option-tests/'], {
      config: false,
      watch: false,
      ...testConfig,
      name: `${provider} - ${testConfig.name}`,
      coverage: {
        enabled: true,
        clean: true,
        all: false,
        reporter: [],
        provider,
        ...testConfig.coverage,
      },
    })

    // Check generated coverage report
    if (assertionConfig) {
      await startVitest('test', ['coverage-report-tests'], {
        config: false,
        watch: false,
        ...assertionConfig,
        name: `${provider} - assert ${testConfig.name}`,
      })
    }

    await after?.()

    checkExit()
  }
}

function checkExit() {
  if (process.exitCode)
    process.exit(process.exitCode)
}
