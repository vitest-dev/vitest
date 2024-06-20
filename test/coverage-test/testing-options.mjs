import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
    skip: !!process.env.ECOSYSTEM_CI,
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
  {
    testConfig: {
      name: 'ignore empty lines',
      include: ['option-tests/empty-lines.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: 'json',
        all: true,
        include: ['src/empty-lines.ts', 'src/untested-file.ts'],
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/ignore-empty-lines.test.ts'],
    },
  },
  {
    testConfig: {
      name: 'include empty lines',
      include: ['option-tests/empty-lines.test.ts'],
      coverage: {
        provider: 'v8',
        reporter: 'json',
        ignoreEmptyLines: false,
        all: true,
        include: ['src/empty-lines.ts', 'src/untested-file.ts'],
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/include-empty-lines.test.ts'],
    },
  },
  {
    testConfig: {
      name: 'failing thresholds',
      include: ['option-tests/thresholds.test.ts'],
      coverage: {
        reporter: 'text',
        all: false,
        include: ['src/utils.ts'],
        thresholds: {
          'src/utils.ts': {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
          },
        },
      },
    },
    after() {
      if (process.exitCode !== 1) {
        throw new Error('Expected test to fail as thresholds are not met')
      }

      process.exitCode = 0
    },
  },
  {
    testConfig: {
      name: 'remove empty coverages directory',
      include: ['option-tests/fixture.test.ts'],
      coverage: {
        reporter: 'text',
        all: false,
        include: ['src/utils.ts'],
      },
    },
    after() {
      if (existsSync('./coverage')) {
        if (readdirSync('./coverage').length !== 0) {
          throw new Error('Test case expected coverage directory to be empty')
        }

        throw new Error('Empty coverage directory was not cleaned')
      }
    },
  },
  ...[1, 2, 3].map(index => ({
    testConfig: {
      name: `generate #${index} blob report`,
      include: ['option-tests/merge-fixture-*.test.ts'],
      reporters: 'blob',
      shard: `${index}/3`,
      coverage: {
        reporter: [],
        all: false,
        include: ['src'],
      },
    },
  })),
  {
    testConfig: {
      name: 'merge blob reports',
      // Pass default value - this option is publicly only available via CLI so it's a bit hacky usage here
      mergeReports: '.vitest-reports',
      reporter: 'dot',
      coverage: {
        reporter: 'json',
        all: false,
      },
    },
    assertionConfig: {
      include: ['coverage-report-tests/merge-reports.test.ts'],
    },
  },
  {
    testConfig: {
      name: 'thresholds autoUpdate',
      include: ['option-tests/thresholds-auto-update.test.ts'],
      coverage: { provider: 'v8', enabled: false },
    },
  },
]

for (const provider of ['v8', 'istanbul']) {
  for (const { after, before, testConfig, assertionConfig, skip } of testCases) {
    if (skip) {
      continue
    }
    // Test config may specify which provider the test is for
    if (testConfig.coverage?.provider && testConfig.coverage.provider !== provider) {
      continue
    }

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
  if (process.exitCode) {
    console.error(`Exit code was set to ${process.exitCode}. Failing tests`)
    process.exit(process.exitCode)
  }
}
