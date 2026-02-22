import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('correctly imports external dependencies with a development condition', async () => {
  // dev condition is the default
  const { stderr } = await runVitest({
    root: 'fixtures/conditions-test',
    server: {
      deps: {
        external: [/conditions-pkg/],
      },
    },
    $viteConfig: {
      define: {
        TEST_CONDITION: '"development"',
      },
    },
  })

  expect(stderr).toBe('')
})

test('correctly imports external dependencies with a production condition', async () => {
  // this is the only check in Vite for "isProduction" value
  process.env.NODE_ENV = 'production'

  const { stderr } = await runVitest({
    root: 'fixtures/conditions-test',
    server: {
      deps: {
        external: [/conditions-pkg/],
      },
    },
    $viteConfig: {
      define: {
        TEST_CONDITION: '"production"',
      },
    },
  })

  expect(stderr).toBe('')
})

test('correctly imports external dependencies with a custom condition', async () => {
  delete process.env.NODE_ENV

  const { stderr } = await runVitest({
    root: 'fixtures/conditions-test',
    server: {
      deps: {
        external: [/conditions-pkg/],
      },
    },
    $viteConfig: {
      resolve: {
        conditions: ['custom'],
      },
      ssr: {
        resolve: {
          conditions: ['custom'],
        },
      },
      define: {
        TEST_CONDITION: '"custom"',
      },
    },
  })

  expect(stderr).toBe('')
})

test('conditions (external)', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/conditions',
  })

  expect(stderr).toBe('')
})

test('conditions (inline direct)', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/conditions',
    server: {
      deps: {
        inline: ['@vitest/test-dep-conditions'],
      },
    },
  })

  expect(stderr).toBe('')
})

test('conditions (inline indirect)', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/conditions',
    server: {
      deps: {
        inline: ['@vitest/test-dep-conditions', '@vitest/test-dep-conditions-indirect'],
      },
    },
  })

  expect(stderr).toBe('')
})

test('project resolve.conditions', async () => {
  const { stderr, errorProjectTree } = await runVitest({
    root: 'fixtures/conditions-projects',
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  |project-a| basic.test.js > conditions
    AssertionError: expected { inline: false, …(6) } to deeply equal { inline: false, …(6) }

    - Expected
    + Received

    @@ -1,7 +1,7 @@
      {
    -   "conditionCustom": true,
    +   "conditionCustom": false,
        "conditionDevelopment": true,
        "conditionModule": false,
        "conditionNode": true,
        "conditionProduction": false,
        "indirect": {

     ❯ basic.test.js:22:6
         20|     conditionProduction,
         21|     indirect,
         22|   }).toEqual({
           |      ^
         23|     inline: false,
         24|     conditionCustom: true,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(errorProjectTree()).toMatchInlineSnapshot(`
    {
      "project-a": {
        "basic.test.js": {
          "conditions": [
            "expected { inline: false, …(6) } to deeply equal { inline: false, …(6) }",
          ],
        },
      },
      "project-b": {
        "basic.test.js": {
          "conditions": "passed",
        },
      },
    }
  `)
})
