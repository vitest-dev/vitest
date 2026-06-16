import { runInlineTests } from '#test-utils'
import { expect, it } from 'vitest'

const dynamicTestContent = `// Dynamic test added by test/watch/workspaces.test.ts
import { expect, test } from "vitest";

test("dynamic test case", () => {
  console.log("Running added dynamic test")
  expect(true).toBeTruthy()
})
`

it('editing a test file in a project reruns its tests', async () => {
  const { fs, vitest } = await runInlineTests({
    'space_2/node.spec.ts': `
      import { expect, test } from 'vitest'
      test('window is not defined', () => {
        expect(typeof window).toBe('undefined')
      })
    `,
    'vitest.config.ts': {
      test: {
        projects: [
          { test: { name: 'space_2', root: './space_2', environment: 'node' } },
        ],
      },
    },
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  fs.editFile('space_2/node.spec.ts', content => `${content}\n`)

  await vitest.waitForStdout('RERUN  ../space_2/node.spec.ts')
  await vitest.waitForStdout('|space_2| node.spec.ts')
  await vitest.waitForStdout('Test Files  1 passed')
})

it('editing a file imported in different projects reruns both files', async () => {
  const { fs, vitest } = await runInlineTests({
    'src/math.ts': `export function sum(a, b) {
      return a + b
    }`,
    'space_1/math.spec.ts': `
      import { expect, test } from 'vitest'
      import { sum } from '../src/math'
      test('1 + 1 = 2', () => {
        expect(sum(1, 1)).toBe(2)
      })
    `,
    'space_3/math.space-3-test.ts': `
      import { expect, test } from 'vitest'
      import { sum } from '../src/math'
      test('2 + 2 = 4', () => {
        expect(sum(2, 2)).toBe(4)
      })
    `,
    'vitest.config.ts': {
      test: {
        projects: [
          { test: { name: 'space_1', root: './space_1', environment: 'node' } },
          {
            test: {
              name: 'space_3',
              root: './space_3',
              include: ['**/*.space-3-test.ts'],
              environment: 'node',
            },
          },
        ],
      },
    },
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  fs.editFile('src/math.ts', content => `${content}\n`)

  await vitest.waitForStdout('RERUN  ../src/math.ts')
  await vitest.waitForStdout('|space_1| math.spec.ts')
  await vitest.waitForStdout('|space_3| math.space-3-test.ts')
  await vitest.waitForStdout('Test Files  2 passed')
})

it('filters by test name inside a project', async () => {
  const { vitest } = await runInlineTests({
    'space_3/math.space-3-test.ts': `
      import { expect, test } from 'vitest'
      test('2 x 2 = 4', () => {
        expect(2 * 2).toBe(4)
      })
      test('2 + 2 = 4', () => {
        expect(2 + 2).toBe(4)
      })
    `,
    'vitest.config.ts': {
      test: {
        projects: [
          {
            test: {
              name: 'space_3',
              root: './space_3',
              include: ['**/*.space-3-test.ts'],
              environment: 'node',
            },
          },
        ],
      },
    },
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')

  vitest.write('t')
  await vitest.waitForStdout('Input test name pattern')

  vitest.write('2 x 2 = 4\n')

  await vitest.waitForStdout('Test name pattern: /2 x 2 = 4/')
  await vitest.waitForStdout('Test Files  1 passed')
})

it('adding a new test file matching the default project config triggers a re-run', async () => {
  const { fs, vitest } = await runInlineTests({
    'space_2/node.spec.ts': `
      import { test } from 'vitest'
      test('window is not defined', () => {})
    `,
    'space_3/math.space-3-test.ts': `
      import { test } from 'vitest'
      test('2 + 2 = 4', () => {})
    `,
    'vitest.config.ts': {
      test: {
        projects: [
          { test: { name: 'space_2', root: './space_2', environment: 'node' } },
          {
            test: {
              name: 'space_3',
              root: './space_3',
              include: ['**/*.space-3-test.ts'],
              environment: 'node',
            },
          },
        ],
      },
    },
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  fs.createFile('space_2/new-dynamic.test.ts', dynamicTestContent)

  await vitest.waitForStdout('Running added dynamic test')
  await vitest.waitForStdout('RERUN  ../space_2/new-dynamic.test.ts')
  await vitest.waitForStdout('|space_2| new-dynamic.test.ts')

  // Wait for tests to end
  await vitest.waitForStdout('Waiting for file changes')

  // The new file should not be picked up by the project with a custom include
  expect(vitest.stdout).not.include('|space_3|')
})

it('adding a new test file matching a project specific config triggers a re-run', async () => {
  const { fs, vitest } = await runInlineTests({
    'space_2/node.spec.ts': `
      import { test } from 'vitest'
      test('window is not defined', () => {})
    `,
    'space_3/math.space-3-test.ts': `
      import { test } from 'vitest'
      test('2 + 2 = 4', () => {})
    `,
    'vitest.config.ts': {
      test: {
        projects: [
          { test: { name: 'space_2', root: './space_2', environment: 'node' } },
          {
            test: {
              name: 'space_3',
              root: './space_3',
              include: ['**/*.space-3-test.ts'],
              environment: 'node',
            },
          },
        ],
      },
    },
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')
  vitest.resetOutput()

  fs.createFile('space_3/new-dynamic.space-3-test.ts', dynamicTestContent)

  await vitest.waitForStdout('Running added dynamic test')
  await vitest.waitForStdout('RERUN  ../space_3/new-dynamic.space-3-test.ts')
  await vitest.waitForStdout('|space_3| new-dynamic.space-3-test.ts')

  // Wait for tests to end
  await vitest.waitForStdout('Waiting for file changes')

  // The new file should not be picked up by the default-include project
  expect(vitest.stdout).not.toContain('|space_2|')
})

it('editing a setup file inside the project reruns tests', async () => {
  const { fs, vitest } = await runInlineTests({
    'setupFile.js': '',
    'project-1/basic.test.js': `test("[p1] reruns", () => {})`,
    'project-2/basic.test.js': `test("[p2] doesn\'t rerun", () => {})`,
    'vitest.config.js': {
      test: {
        projects: [
          {
            test: {
              name: 'p1',
              include: ['./project-1/basic.test.js'],
              setupFiles: ['./setupFile.js'],
              globals: true,
            },
          },
          {
            test: {
              name: 'p2',
              include: ['./project-2/basic.test.js'],
              globals: true,
            },
          },
        ],
      },
    },
  }, { watch: true })

  await vitest.waitForStdout('Waiting for file changes')
  expect(vitest.stdout).toContain('[p1] reruns')
  expect(vitest.stdout).toContain('[p2] doesn\'t rerun')

  fs.editFile('./setupFile.js', () => '// ---edit')

  vitest.resetOutput()
  await vitest.waitForStdout('Test Files  1 passed')

  expect(vitest.stdout).toContain('[p1] reruns')
  expect(vitest.stdout).not.toContain('[p2] doesn\'t rerun')
})
