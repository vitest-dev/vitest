import { runInlineTests } from '#test-utils'
import { playwright } from '@vitest/browser-playwright'
import { expect, it } from 'vitest'

it('browser mode headless', async () => {
  const result = await runInlineTests({
    'basic.test.ts': /* ts */`
import { test } from "vitest";
test('basic', () => {});
`,
  }, {
    reporters: ['default', 'html'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium' as const },
      ],
    },
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)
  expect(result.fs.statFile('html/index.html').isFile()).toBe(true)
})

it('html and coverage already next each other', async () => {
  const result = await runInlineTests({
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
  }, {
    reporters: [
      'default',
      ['html', { outputFile: './custom-dir/index.html' }],
    ],
    coverage: {
      enabled: true,
      reporter: ['html'],
      reportsDirectory: './custom-dir/coverage',
    },
  })
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
  const result = await runInlineTests({
    'basic.test.ts': /* ts */`
import { test } from "vitest";
test('basic', () => {});
`,
  }, {
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
  })
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
