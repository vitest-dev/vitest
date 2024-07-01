import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test.each([
  ['--pool=threads'],
  ['--pool=forks'],
  ['--pool=vmForks'],
  ['--browser.enabled'],
])('correctly outputs all tests with args: "%s"', async (...args) => {
  const { stdout } = await runVitestCli('list', '-r=./fixtures/list', ...args)
  expect(stdout).toMatchSnapshot()
})

test('correctly outputs json', async () => {
  const { stdout } = await runVitestCli('list', '-r=./fixtures/list', '--json')
  expect(relative(stdout)).toMatchInlineSnapshot(`
    "[
      {
        "name": "basic suite > inner suite > some test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > inner suite > another test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > basic test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "outside test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "1 plus 1",
        "file": "<root>/fixtures/list/math.test.ts"
      },
      {
        "name": "failing test",
        "file": "<root>/fixtures/list/math.test.ts"
      }
    ]
    "
  `)
})

test('correctly saves json', async () => {
  const { stdout } = await runVitestCli('list', '-r=./fixtures/list', '--json=./list.json')
  const json = readFileSync('./fixtures/list/list.json', 'utf-8')
  expect(stdout).toBe('')
  expect(relative(json)).toMatchInlineSnapshot(`
    "[
      {
        "name": "basic suite > inner suite > some test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > inner suite > another test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "basic suite > basic test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "outside test",
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "name": "1 plus 1",
        "file": "<root>/fixtures/list/math.test.ts"
      },
      {
        "name": "failing test",
        "file": "<root>/fixtures/list/math.test.ts"
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
  expect(relative(stdout)).toMatchInlineSnapshot(`
    "[
      {
        "name": "1 plus 1",
        "file": "<root>/fixtures/list/math.test.ts",
        "projectName": "custom",
        "location": {
          "line": 3,
          "column": 1
        }
      },
      {
        "name": "failing test",
        "file": "<root>/fixtures/list/math.test.ts",
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

function relative(stdout: string) {
  return stdout.replace(new RegExp(process.cwd(), 'g'), '<root>')
}
