import { playwright } from '@vitest/browser-playwright'
import { expect, it } from 'vitest'
import { runInlineTests, StableTestFileOrderSorter } from '#test-utils'

it('basic', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': `test('basic', () => {});`,
    },
    {
      globals: true,
      reporters: ['default', 'html'],
    },
  )
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)
  expect(result.exitCode).toBe(0)
  expect(result.fs.statFile('.vitest/index.html').isFile()).toBe(true)
})

it('singleFile', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': `test('basic', () => {});`,
    },
    {
      globals: true,
      reporters: ['default', ['html', { singleFile: true }]],
    },
  )
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)
  expect(result.exitCode).toBe(0)
  expect(result.fs.statFile('.vitest/index.html').isFile()).toBe(true)
})

it('bail before all files run', async () => {
  const result = await runInlineTests(
    {
      'a-fail.test.ts': `test('fail', () => { expect(1).toBe(2) });`,
      'b-pass.test.ts': `test('pass', () => {});`,
    },
    {
      globals: true,
      bail: 1,
      // each file gets its own worker run, one at a time, so bail cancels b-pass.test.ts before a worker picks it up
      isolate: true,
      fileParallelism: false,
      sequence: { sequencer: StableTestFileOrderSorter },
      reporters: ['default', 'html'],
    },
  )
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  a-fail.test.ts:1 > fail
    AssertionError: expected 1 to be 2 // Object.is equality

    - Expected
    + Received

    - 2
    + 1

     ❯ a-fail.test.ts:1:32
          1| test('fail', () => { expect(1).toBe(2) });
           |                                ^

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "a-fail.test.ts": {
        "fail": [
          "expected 1 to be 2 // Object.is equality",
        ],
      },
      "b-pass.test.ts": {},
    }
  `)
  expect(result.fs.statFile('.vitest/index.html').isFile()).toBe(true)
})

it('browser mode headless', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
import { test } from "vitest";
test('basic', () => {});
`,
    },
    {
      reporters: ['default', 'html'],
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: 'chromium' as const }],
      },
    },
  )
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)
  expect(result.fs.statFile('.vitest/index.html').isFile()).toBe(true)
})

it('html and coverage already next each other', async () => {
  const result = await runInlineTests(
    {
      'basic.ts': `
export const add = (a: number, b: number) => a + b;
`,
      'basic.test.ts': `
import { test, expect } from "vitest";
import { add } from "./basic";
test('add', () => {
  expect(add(1, 2)).toBe(3);
});
`,
    },
    {
      reporters: ['default', ['html', { outputDir: './custom-dir' }]],
      coverage: {
        enabled: true,
        reporter: ['html'],
        reportsDirectory: './custom-dir/coverage',
      },
    },
  )
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "add": "passed",
      },
    }
  `)
  expect({
    html: result.fs.statFile('custom-dir/index.html').isFile(),
    coverage: result.fs.statFile('custom-dir/coverage/index.html').isFile(),
  }).toMatchInlineSnapshot(`
    {
      "coverage": true,
      "html": true,
    }
  `)
})

it('projects', async () => {
  const result = await runInlineTests(
    {
      'basic.test.ts': /* ts */ `
import { test } from "vitest";
test('basic', () => {});
`,
    },
    {
      reporters: ['default', 'html'],
      projects: [
        {
          test: {
            name: {
              label: 'project1',
              color: 'black',
            },
          },
        },
        {
          test: {
            name: {
              label: 'project2',
              color: 'white',
            },
          },
        },
      ],
    },
  )
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree({ project: true })).toMatchInlineSnapshot(`
    {
      "project1": {
        "basic.test.ts": {
          "basic": "passed",
        },
      },
      "project2": {
        "basic.test.ts": {
          "basic": "passed",
        },
      },
    }
  `)
  expect(result.ctx?.serializedRootConfig.projects).toMatchObject([
    {
      name: 'project1',
      color: 'black',
    },
    {
      name: 'project2',
      color: 'white',
    },
  ])
})
