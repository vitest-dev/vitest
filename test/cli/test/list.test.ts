import { readFileSync, rmSync } from 'node:fs'
import { expect, onTestFinished, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test.each([
  ['--pool=threads'],
  ['--pool=forks'],
  ['--pool=vmForks'],
  ['--browser.enabled'],
])('correctly outputs all tests with args: "%s"', async (...args) => {
  const { stdout, exitCode } = await runVitestCli('list', '-r=./fixtures/list', ...args)
  expect(stdout).toMatchSnapshot()
  expect(exitCode).toBe(0)
})

test.each([
  ['basic'],
  ['json', '--json'],
  ['json with a file', '--json=./list.json'],
])('%s output shows error', async (_, ...args) => {
  const { stderr, stdout, exitCode } = await runVitestCli('list', '-r=./fixtures/list', '-c=fail.config.ts', ...args)
  expect(stdout).toBe('')
  expect(stderr).toMatchSnapshot()
  expect(exitCode).toBe(1)
})

test('correctly outputs json', async () => {
  const { stdout, exitCode } = await runVitestCli('list', '-r=./fixtures/list', '--json')
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
  expect(exitCode).toBe(0)
})

test('correctly outputs files only json', async () => {
  const { stdout, exitCode } = await runVitestCli('list', '-r=./fixtures/list', '--json', '--filesOnly')
  expect(relative(stdout)).toMatchInlineSnapshot(`
    "[
      {
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "file": "<root>/fixtures/list/math.test.ts"
      }
    ]
    "
  `)
  expect(exitCode).toBe(0)
})

test('correctly saves json', async () => {
  const { stdout, exitCode } = await runVitestCli('list', '-r=./fixtures/list', '--json=./list.json')
  onTestFinished(() => {
    rmSync('./fixtures/list/list.json')
  })
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
  expect(exitCode).toBe(0)
})

test('correctly saves files only json', async () => {
  const { stdout, exitCode } = await runVitestCli('list', '-r=./fixtures/list', '--json=./list.json', '--filesOnly')
  onTestFinished(() => {
    rmSync('./fixtures/list/list.json')
  })
  const json = readFileSync('./fixtures/list/list.json', 'utf-8')
  expect(stdout).toBe('')
  expect(relative(json)).toMatchInlineSnapshot(`
    "[
      {
        "file": "<root>/fixtures/list/basic.test.ts"
      },
      {
        "file": "<root>/fixtures/list/math.test.ts"
      }
    ]"
  `)
  expect(exitCode).toBe(0)
})

test('correctly filters by file', async () => {
  const { stdout, exitCode } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list')
  expect(stdout).toMatchInlineSnapshot(`
    "math.test.ts > 1 plus 1
    math.test.ts > failing test
    "
  `)
  expect(exitCode).toBe(0)
})

test('correctly filters by file when using --filesOnly', async () => {
  const { stdout, exitCode } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list', '--filesOnly')
  expect(stdout).toMatchInlineSnapshot(`
    "math.test.ts
    "
  `)
  expect(exitCode).toBe(0)
})

test('correctly prints project name in basic report', async () => {
  const { stdout } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list', '--config=./custom.config.ts')
  expect(stdout).toMatchInlineSnapshot(`
    "[custom] math.test.ts > 1 plus 1
    [custom] math.test.ts > failing test
    "
  `)
})

test('correctly prints project name in basic report when using --filesOnly', async () => {
  const { stdout } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list', '--config=./custom.config.ts', '--filesOnly')
  expect(stdout).toMatchInlineSnapshot(`
    "[custom] math.test.ts
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
          "line": 5,
          "column": 1
        }
      },
      {
        "name": "failing test",
        "file": "<root>/fixtures/list/math.test.ts",
        "projectName": "custom",
        "location": {
          "line": 9,
          "column": 1
        }
      }
    ]
    "
  `)
})

test('correctly prints project name in json report when using --filesOnly', async () => {
  const { stdout } = await runVitestCli('list', 'math.test.ts', '-r=./fixtures/list', '--json', '--config=./custom.config.ts', '--filesOnly')
  expect(relative(stdout)).toMatchInlineSnapshot(`
    "[
      {
        "file": "<root>/fixtures/list/math.test.ts",
        "projectName": "custom"
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
  return stdout.replace(new RegExp(slash(process.cwd()), 'gi'), '<root>')
}

function slash(stdout: string) {
  return stdout.replace(/\\/g, '/')
}
