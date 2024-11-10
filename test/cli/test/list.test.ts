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

test('file not found mentions strict matching for location filters', async () => {
  const { stdout, stderr } = await runVitestCli(
    'list',
    '-r=./fixtures/list',
    '--config=custom.config.ts',
    'a/file/that/doesnt/exit:10',
  )

  expect(stderr).toMatchSnapshot()
  expect(stdout).toEqual('')
})

test('location filter finds test at correct line number', async () => {
  const { stdout, stderr } = await runVitestCli(
    'list',
    '-r=./fixtures/list',
    '--config=custom.config.ts',
    'basic.test.ts:5',
  )

  expect(stdout).toMatchInlineSnapshot(`
    "[custom] basic.test.ts > basic suite > inner suite > some test
    "
  `)
  expect(stderr).toEqual('')
})

test('location filter reports not found test', async () => {
  const { stdout, stderr } = await runVitestCli(
    'list',
    '-r=./fixtures/list',
    '--config=custom.config.ts',
    'basic.test.ts:99',
  )

  expect(stdout).toEqual('')
  expect(stderr).toMatchInlineSnapshot(`
    "Error: No test found in basic.test.ts in line 99
    "
  `)
})

test('location filter reports multiple not found tests', async () => {
  const { stdout, stderr } = await runVitestCli(
    'list',
    '-r=./fixtures/list',
    '--config=custom.config.ts',
    'basic.test.ts:5',
    'basic.test.ts:12',
    'basic.test.ts:99',
  )

  expect(stdout).toEqual('')
  expect(stderr).toMatchInlineSnapshot(`
    "Error: No test found in basic.test.ts in lines 12, 99
    "
  `)
})

test('error if range location is provided', async () => {
  const { stdout, stderr } = await runVitestCli(
    'list',
    '-r=./fixtures/list',
    'a/file/that/doesnt/exit:10-15',
  )

  expect(stdout).toEqual('')
  expect(stderr).toContain('Collect Error')
  expect(stderr).toContain('RangeLocationFilterProvidedError')
})

test('erorr if location filter provided without enabling includeTaskLocation', async () => {
  const { stdout, stderr } = await runVitestCli(
    'list',
    '-r=./fixtures/list',
    '--config=no-task-location.config.ts',
    'a/file/that/doesnt/exist:5',
  )

  expect(stdout).toEqual('')
  expect(stderr).toContain('Collect Error')
  expect(stderr).toContain('IncludeTaskLocationDisabledError')
})

function relative(stdout: string) {
  return stdout.replace(new RegExp(slash(process.cwd()), 'gi'), '<root>')
}

function slash(stdout: string) {
  return stdout.replace(/\\/g, '/')
}
