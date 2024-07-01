import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test.each([
  ['--pool=threads'],
  ['--pool=forks'],
  ['--pool=vmForks'],
  ['--browser=chromium', '--browser.provider=playwright', '--browser.headless'],
])('correctly outputs all tests with args: "%s"', async (...args) => {
  const { stdout } = await runVitestCli('list', '-r=./fixtures/list', ...args)
  expect(stdout).toMatchSnapshot()
})

test('correctly outputs json', async () => {
  const { stdout } = await runVitestCli('list', '-r=./fixtures/list', '--json')
  expect(stdout).toMatchInlineSnapshot(`
    "[
      {
        "name": "basic suite > inner suite > some test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > inner suite > another test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > basic test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "outside test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "1 plus 1",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/math.test.ts"
      },
      {
        "name": "failing test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/math.test.ts"
      }
    ]
    "
  `)
})

test('correctly saves json', async () => {
  const { stdout } = await runVitestCli('list', '-r=./fixtures/list', '--json=./list.json')
  const json = readFileSync('./fixtures/list/list.json', 'utf-8')
  expect(stdout).toBe('')
  expect(json).toMatchInlineSnapshot(`
    "[
      {
        "name": "basic suite > inner suite > some test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > inner suite > another test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > basic test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "outside test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/basic.test.ts"
      },
      {
        "name": "1 plus 1",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/math.test.ts"
      },
      {
        "name": "failing test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/math.test.ts"
      }
    ]"
  `)
})

test('correctly filters by file', async () => {
  const { stdout } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list')
  expect(stdout).toMatchInlineSnapshot(`
    "math.test.ts > 1 plus 1
    math.test.ts > failing test
    "
  `)
})

test('correctly prints project name in basic report', async () => {
  const { stdout } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list', '--config=./custom.config.ts')
  expect(stdout).toMatchInlineSnapshot(`
    "[custom] math.test.ts > 1 plus 1
    [custom] math.test.ts > failing test
    "
  `)
})

test('correctly prints project name and locations in json report', async () => {
  const { stdout } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list', '--json', '--config=./custom.config.ts')
  expect(stdout).toMatchInlineSnapshot(`
    "[
      {
        "name": "1 plus 1",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/math.test.ts",
        "projectName": "custom",
        "location": {
          "line": 3,
          "column": 1
        }
      },
      {
        "name": "failing test",
        "file": "/Users/sheremet.mac/Projects/vitest/test/cli/fixtures/list/math.test.ts",
        "projectName": "custom",
        "location": {
          "line": 7,
          "column": 1
        }
      }
    ]
    "
  `)
})

test('correctly filters by test name', async () => {
  const { stdout } = await runVitestCli('list', '-t=inner', '-r=./fixtures/list')
  expect(stdout).toMatchInlineSnapshot(`
    "basic.test.ts > basic suite > inner suite > some test
    basic.test.ts > basic suite > inner suite > another test
    "
  `)
})

test('ignores watch flag', async () => {
  // if it ends, it works - otherwise it will hang
  const { stdout } = await runVitestCli('list', '-r=./fixtures/list', '--watch')
  expect(stdout).toMatchInlineSnapshot(`
    "basic.test.ts > basic suite > inner suite > some test
    basic.test.ts > basic suite > inner suite > another test
    basic.test.ts > basic suite > basic test
    basic.test.ts > outside test
    math.test.ts > 1 plus 1
    math.test.ts > failing test
    "
  `)
})
