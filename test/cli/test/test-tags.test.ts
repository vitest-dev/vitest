import type { TestCase, TestSuite } from 'vitest/node'
import { runInlineTests, runVitest } from '#test-utils'
import { expect, test } from 'vitest'

test('vitest records tags', async () => {
  const { stderr, buildTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite_2' },
      { name: 'test_2' },
    ],
  })

  expect(stderr).toBe('')
  expect(getTestTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": [
              "suite",
              "alone",
              "suite_2",
            ],
            "test 4": [
              "suite",
              "alone",
              "suite_2",
              "test_2",
            ],
          },
          "test 1": [
            "suite",
            "alone",
          ],
          "test 2": [
            "suite",
            "alone",
            "test",
          ],
        },
      },
    }
  `)
})

test('filters tests based on --tags-filter=!ignore', async () => {
  const { stderr, testTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite_2' },
      { name: 'test_2' },
    ],
    tagsFilter: ['!suite_2'],
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": "skipped",
            "test 4": "skipped",
          },
          "test 1": "passed",
          "test 2": "passed",
        },
      },
    }
  `)
})

test('filters tests based on --tags-filter=!ignore and --tags-filter=include', async () => {
  const { stderr, testTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite_2' },
      { name: 'test_2' },
    ],
    tagsFilter: ['!suite_2', 'test'],
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": "skipped",
            "test 4": "skipped",
          },
          "test 1": "skipped",
          "test 2": "passed",
        },
      },
    }
  `)
})

test('filters tests based on --tags-filter=include', async () => {
  const { stderr, testTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      { name: 'suite' },
      { name: 'test' },
      { name: 'suite_2' },
      { name: 'test_2' },
    ],
    tagsFilter: ['test*'],
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": "skipped",
            "test 4": "passed",
          },
          "test 1": "skipped",
          "test 2": "passed",
        },
      },
    }
  `)
})

test('throws an error if no tags are defined in the config, but in the test', async () => {
  const { stderr } = await runInlineTests(
    {
      'basic.test.js': `
        test('test 1', { tags: ['unknown'] }, () => {})
      `,
    },
    { globals: true },
  )

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.js [ basic.test.js ]
    Error: The Vitest config does't define any "tags", cannot apply "unknown" tag for this test. See: https://vitest.dev/guide/test-tags
     ❯ basic.test.js:2:9
          1|
          2|         test('test 1', { tags: ['unknown'] }, () => {})
           |         ^
          3|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('throws an error if tag is not defined in the config, but in the test', async () => {
  const { stderr } = await runInlineTests(
    {
      'basic.test.js': `
        test('test 1', { tags: ['unknown'] }, () => {})
      `,
    },
    {
      globals: true,
      tags: [{ name: 'known' }],
    },
  )

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.js [ basic.test.js ]
    Error: The tag "unknown" is not defined in the configuration. Available tags are:
    - known
     ❯ basic.test.js:2:9
          1|
          2|         test('test 1', { tags: ['unknown'] }, () => {})
           |         ^
          3|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('throws an error if tag is not defined in the config, but in --tags-filter filter', async () => {
  const { stderr } = await runInlineTests(
    {
      'basic.test.js': '',
    },
    {
      tagsFilter: ['unknown'],
    },
    { fails: true },
  )
  expect(stderr).toContain('The Vitest config does\'t define any "tags", cannot apply "unknown" tag pattern for this test. See: https://vitest.dev/guide/test-tags')
})

test('defining a tag available only in one project', async () => {
  const { stderr, buildTree, ctx } = await runInlineTests({
    'basic-1.test.js': `
      test('test 1', { tags: ['project-1-tag'] }, () => {})
    `,
    'basic-2.test.js': `
      test('test 2', { tags: ['global-tag', 'project-2-tag'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'global-tag' },
        ],
        projects: [
          {
            extends: true,
            test: {
              name: 'project-1',
              include: ['basic-1.test.js'],
              tags: [
                { name: 'project-1-tag' },
                { name: 'override', timeout: 100 },
              ],
            },
          },
          {
            extends: true,
            test: {
              name: 'project-2',
              include: ['basic-2.test.js'],
              tags: [
                { name: 'project-2-tag' },
                { name: 'override', timeout: 200 },
              ],
            },
          },
        ],
      },
    },
  }, {
    tagsFilter: ['project-2-tag'],
  })
  expect(stderr).toBe('')
  expect(Object.fromEntries(ctx!.projects.map(p => [p.name, p.config.tags]))).toMatchInlineSnapshot(`
    {
      "project-1": [
        {
          "name": "project-1-tag",
        },
        {
          "name": "override",
          "timeout": 100,
        },
        {
          "name": "global-tag",
        },
        {
          "name": "project-2-tag",
        },
      ],
      "project-2": [
        {
          "name": "project-2-tag",
        },
        {
          "name": "override",
          "timeout": 200,
        },
        {
          "name": "global-tag",
        },
        {
          "name": "project-1-tag",
        },
      ],
    }
  `)
  expect(buildOptionsTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic-1.test.js": {
        "test 1": {
          "mode": "run",
          "tags": [
            "project-1-tag",
          ],
          "timeout": 5000,
        },
      },
      "basic-2.test.js": {
        "test 2": {
          "mode": "run",
          "tags": [
            "global-tag",
            "project-2-tag",
          ],
          "timeout": 5000,
        },
      },
    }
  `)
})

test('can specify custom options for tags', async () => {
  const { stderr, buildTree } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      { name: 'suite', timeout: 1000 },
      { name: 'test', retry: 2, skip: true },
      { name: 'suite_2', repeats: 3 },
      { name: 'test_2', timeout: 500, retry: 1 },
    ],
  })
  expect(stderr).toBe('')
  expect(buildOptionsTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "suite 1": {
          "suite 2": {
            "test 3": {
              "mode": "run",
              "repeats": 3,
              "tags": [
                "suite",
                "alone",
                "suite_2",
              ],
              "timeout": 1000,
            },
            "test 4": {
              "mode": "run",
              "repeats": 3,
              "retry": 1,
              "tags": [
                "suite",
                "alone",
                "suite_2",
                "test_2",
              ],
              "timeout": 500,
            },
          },
          "test 1": {
            "mode": "run",
            "tags": [
              "suite",
              "alone",
            ],
            "timeout": 1000,
          },
          "test 2": {
            "mode": "skip",
            "retry": 2,
            "tags": [
              "suite",
              "alone",
              "test",
            ],
            "timeout": 1000,
          },
        },
      },
    }
  `)
})

test('can specify custom options with priorities for tags', async () => {
  const { stderr, ctx } = await runVitest({
    root: './fixtures/test-tags',
    config: false,
    tags: [
      { name: 'alone' },
      {
        name: 'test',
        timeout: 500,
        skip: false,
        concurrent: true,
        fails: false,
        priority: 1,
      },
      {
        name: 'suite',
        timeout: 1000,
        skip: true,
        concurrent: false,
        fails: true,
        priority: 2,
      },
      { name: 'suite_2' },
      { name: 'test_2' },
    ],
  })

  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testSuite = testModule.children.at(0) as TestSuite
  const testCase = testSuite.children.at(1) as TestCase

  expect(testCase.name).toBe('test 2')
  expect(testCase.options.tags).toEqual(['suite', 'alone', 'test'])
  // from 'test' tag (priority 1 is higher)
  expect(testCase.options.timeout).toBe(500)
  // concurrent is not set anywhere manually, so
  // test always gets it from the highest priority tag
  expect(testCase.options.concurrent).toBe(true)
  expect(testCase.options.fails).toBe(false)
  expect(testCase.result().state).toBe('passed')
})

test('custom options override tag options', async () => {
  const { stderr, buildTree } = await runInlineTests({
    'basic.test.js': `
      test.fails('test 1', { tags: ['test'], timeout: 2000, skip: false, repeats: 0 }, () => {
        throw new Error('fail')
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          {
            name: 'test',
            timeout: 500,
            skip: true,
            concurrent: true,
            fails: false,
            retry: 2,
            repeats: 2,
          },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  expect(buildOptionsTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": {
          "concurrent": true,
          "fails": true,
          "mode": "run",
          "repeats": 0,
          "retry": 2,
          "tags": [
            "test",
          ],
          "timeout": 2000,
        },
      },
    }
  `)
})

test('strictFlag: false does not throw an error if test has an undefined tag', async () => {
  const { stderr } = await runInlineTests(
    {
      'basic.test.js': `
        test('test 1', { tags: ['unknown'] }, () => {})
      `,
      'vitest.config.js': {
        test: {
          globals: true,
          strictTags: false,
          tags: [{ name: 'known' }],
        },
      },
    },
  )

  expect(stderr).toBe('')
})

test('@module-tag docs inject test tags', async () => {
  const { stderr, buildTree } = await runVitest({
    config: false,
    root: './fixtures/file-tags',
    include: ['./valid-file-tags.test.ts'],
    tags: [
      { name: 'file' },
      { name: 'file-2' },
      { name: 'file/slash' },
      { name: 'test' },
    ],
  })
  expect(stderr).toBe('')
  expect(getTestTree(buildTree)).toMatchInlineSnapshot(`
    {
      "valid-file-tags.test.ts": {
        "suite 1": {
          "test 1": [
            "file",
            "file-2",
            "file/slash",
            "test",
          ],
        },
      },
    }
  `)
})

test('invalid @module-tag throws and error', async () => {
  const { stderr } = await runVitest({
    config: false,
    root: './fixtures/file-tags',
    include: ['./error-file-tags.test.ts'],
    tags: [
      { name: 'file' },
      { name: 'file-2' },
      { name: 'file/slash' },
      { name: 'test' },
    ],
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  error-file-tags.test.ts [ error-file-tags.test.ts ]
    Error: The tag "invalid" is not defined in the configuration. Available tags are:
    - file
    - file-2
    - file/slash
    - test
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('@module-tag on one line docs inject test tags', async () => {
  const { stderr, buildTree } = await runVitest({
    config: false,
    root: './fixtures/file-tags',
    include: ['./valid-file-one-line-comment.test.ts'],
    tags: [
      { name: 'file' },
      { name: 'file-2' },
      { name: 'file/slash' },
      { name: 'test' },
    ],
  })
  expect(stderr).toBe('')
  expect(getTestTree(buildTree)).toMatchInlineSnapshot(`
    {
      "valid-file-one-line-comment.test.ts": {
        "suite 1": {
          "test 1": [
            "file",
            "file-2",
            "file/slash",
            "test",
          ],
        },
      },
    }
  `)
})

test('invalid @module-tag on one line throws and error', async () => {
  const { stderr } = await runVitest({
    config: false,
    root: './fixtures/file-tags',
    include: ['./error-file-one-line-comment.test.ts'],
    tags: [
      { name: 'file' },
      { name: 'file-2' },
      { name: 'file/slash' },
      { name: 'test' },
    ],
  })
  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  error-file-one-line-comment.test.ts [ error-file-one-line-comment.test.ts ]
    Error: The tag "invalid" is not defined in the configuration. Available tags are:
    - file
    - file-2
    - file/slash
    - test
    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
})

test('@module-tag with strictTags: false allows undefined tags', async () => {
  const { stderr, buildTree } = await runVitest({
    config: false,
    root: './fixtures/file-tags',
    include: ['./error-file-tags.test.ts'],
    strictTags: false,
    tags: [
      { name: 'file' },
      { name: 'file-2' },
      { name: 'file/slash' },
      { name: 'test' },
    ],
  })
  expect(stderr).toBe('')
  expect(getTestTree(buildTree)).toMatchInlineSnapshot(`
    {
      "error-file-tags.test.ts": {
        "suite 1": {
          "test 1": [
            "invalid",
            "unknown",
            "test",
          ],
        },
      },
    }
  `)
})

test('sequential tag option makes tests run sequentially', async () => {
  const { stderr, buildTree } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['sequential-tag'] }, () => {})
      test('test 2', { tags: ['sequential-tag'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'sequential-tag', sequential: true },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  // sequential is not visible in options, it affect "concurrent" only, which is not set if false
  expect(buildOptionsTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": {
          "mode": "run",
          "tags": [
            "sequential-tag",
          ],
          "timeout": 5000,
        },
        "test 2": {
          "mode": "run",
          "tags": [
            "sequential-tag",
          ],
          "timeout": 5000,
        },
      },
    }
  `)
})

test('only tag option marks tests as only', async () => {
  const { stderr, buildTree } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['only-tag'] }, () => {})
      test('test 2', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'only-tag', only: true },
        ],
        allowOnly: true,
      },
    },
  })
  expect(stderr).toBe('')
  expect(buildOptionsTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": {
          "mode": "run",
          "tags": [
            "only-tag",
          ],
          "timeout": 5000,
        },
        "test 2": {
          "mode": "skip",
          "tags": [],
          "timeout": 5000,
        },
      },
    }
  `)
})

test('tags without explicit priority use definition order (last wins)', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['tag-a', 'tag-b'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'tag-a', timeout: 1000 },
          { name: 'tag-b', timeout: 2000 },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.options.timeout).toBe(2000)
})

test('equal priority tags use definition order (last wins)', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['tag-a', 'tag-b'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'tag-a', timeout: 1000, priority: 1 },
          { name: 'tag-b', timeout: 2000, priority: 1 },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.options.timeout).toBe(2000)
})

test('negative priority values is not allowed', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['low-priority', 'high-priority'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'low-priority', timeout: 1000, priority: -10 },
        ],
      },
    },
  }, {}, { fails: true })
  expect(stderr).toContain('Tag "low-priority": priority must be a non-negative number.')
})

test.for([
  '!invalid',
  'inv*alid',
  'inv&alid',
  'inv|alid',
  'inv(alid',
  'inv)alid',
])('tag name "%s" containing special character "%s" is not allowed', async (tagName) => {
  const { stderr } = await runInlineTests({
    'basic.test.js': `
      test('test 1', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: tagName },
        ],
      },
    },
  }, {}, { fails: true })
  expect(stderr).toContain(`Tag name "${tagName}" is invalid. Tag names cannot contain "!", "*", "&", "|", "(", or ")".`)
})

test.for([
  'and',
  'or',
  'not',
  'AND',
  'OR',
  'NOT',
])('tag name "%s" is a reserved keyword and is not allowed', async (tagName) => {
  const { stderr } = await runInlineTests({
    'basic.test.js': `
      test('test 1', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: tagName },
        ],
      },
    },
  }, {}, { fails: true })
  expect(stderr).toContain(`Tag name "${tagName}" is invalid. Tag names cannot be a logical operator like "and", "or", "not".`)
})

test('strictTags: false does not allow undefined tags in filter, it only affects test definition', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['known'] }, () => {})
      test('test 2', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        strictTags: false,
        tags: [{ name: 'known' }],
      },
    },
  }, {
    tagsFilter: ['unknown'],
  })
  expect(stderr).toContain(`The tag pattern "unknown" is not defined in the configuration. Available tags are:
- known`)
})

test('--list-tags prints error if no tags are defined', async () => {
  const { stdout, stderr, exitCode } = await runVitest({
    config: false,
    listTags: true,
  })
  expect(stdout).toBe('')
  expect(exitCode).toBe(1)
  expect(stderr).toMatchInlineSnapshot(`
    " ERROR  No test tags found in any project. Exiting with code 1.
    "
  `)
})

test('--list-tags prints tags defined in config', async () => {
  const { stdout, stderr } = await runVitest({
    config: false,
    listTags: true,
    tags: [
      { name: 'unit' },
      { name: 'e2e', description: 'End-to-end tests' },
      { name: 'slow' },
    ],
  })
  expect(stderr).toBe('')
  expect(`\n${stdout}`).toMatchInlineSnapshot(`
    "
      unit
      e2e: End-to-end tests
      slow
    "
  `)
})

test('--list-tags prints tags from multiple projects', async () => {
  const { stdout, stderr } = await runInlineTests({
    'vitest.config.js': {
      test: {
        tags: [
          { name: 'global-tag', description: 'Available in all projects' },
        ],
        projects: [
          {
            extends: true,
            test: {
              name: 'project-1',
              tags: [
                { name: 'project-1-tag' },
              ],
            },
          },
          {
            extends: true,
            test: {
              name: 'project-2',
              tags: [
                { name: 'project-2-tag', description: 'Only in project 2' },
                { name: 'project-2-again' },
              ],
            },
          },
        ],
      },
    },
  }, {
    listTags: true,
  })
  expect(stderr).toBe('')
  expect(`\n${stdout}`).toMatchInlineSnapshot(`
    "
      global-tag: Available in all projects
    |project-1|
      project-1-tag
    |project-2|
      project-2-tag: Only in project 2
      project-2-again
    "
  `)
})

test('--list-tags prints tags with named root project', async () => {
  const { stdout, stderr } = await runInlineTests({
    'vitest.config.js': {
      test: {
        name: 'root',
        tags: [
          { name: 'root-tag' },
          { name: 'another-tag', description: 'From root' },
        ],
        projects: [
          {
            extends: true,
            test: {
              name: 'child',
              tags: [
                { name: 'child-tag' },
                { name: 'child-2-tag' },
              ],
            },
          },
        ],
      },
    },
  }, {
    listTags: true,
  })
  expect(stderr).toBe('')
  expect(`\n${stdout}`).toMatchInlineSnapshot(`
    "
    |root|
      root-tag
      another-tag: From root
    |child|
      child-tag
      child-2-tag
    "
  `)
})

test('--list-tags aligns tags with different project name lengths', async () => {
  const { stdout, stderr } = await runVitest({
    config: false,
    listTags: true,
    projects: [
      {
        test: {
          name: 'a',
          tags: [
            { name: 'tag-1' },
            { name: 'tag-2' },
          ],
        },
      },
      {
        test: {
          name: 'long-project-name',
          tags: [
            { name: 'tag-3' },
            { name: 'tag-4' },
          ],
        },
      },
      {
        test: {
          name: 'medium',
          tags: [
            { name: 'tag-5' },
          ],
        },
      },
    ],
  })
  expect(stderr).toBe('')
  expect(`\n${stdout}`).toMatchInlineSnapshot(`
    "
    |a|
      tag-1
      tag-2
    |long-project-name|
      tag-3
      tag-4
    |medium|
      tag-5
    "
  `)
})

test('--list-tags=json prints error if no tags are defined', async () => {
  const { stdout, stderr } = await runVitest({
    config: false,
    listTags: 'json',
  })
  expect(stdout).toBe('')
  expect(stderr).toContain('No test tags found in any project. Exiting with code 1.')
})

test('--list-tags=json prints tags as JSON', async () => {
  const { stdout, stderr } = await runVitest({
    config: false,
    listTags: 'json',
    tags: [
      { name: 'unit' },
      { name: 'e2e', description: 'End-to-end tests' },
    ],
  })
  expect(stderr).toBe('')
  const json = JSON.parse(stdout)
  expect(json).toEqual({
    tags: [
      { name: 'unit' },
      { name: 'e2e', description: 'End-to-end tests' },
    ],
    projects: [],
  })
})

test('--list-tags=json prints tags from multiple projects', async () => {
  const { stdout, stderr } = await runVitest({
    config: false,
    listTags: 'json',
    tags: [
      { name: 'global-tag' },
    ],
    projects: [
      {
        test: {
          name: 'project-1',
          tags: [
            { name: 'project-1-tag' },
          ],
        },
      },
      {
        test: {
          name: 'project-2',
          tags: [
            { name: 'project-2-tag', description: 'Only in project 2' },
          ],
        },
      },
    ],
  })
  expect(stderr).toBe('')
  const json = JSON.parse(stdout)
  expect(json).toEqual({
    tags: [
      { name: 'global-tag' },
    ],
    projects: [
      {
        name: 'project-1',
        tags: [
          { name: 'project-1-tag' },
        ],
      },
      {
        name: 'project-2',
        tags: [
          { name: 'project-2-tag', description: 'Only in project 2' },
        ],
      },
    ],
  })
})

test('duplicate tags from suite and test are deduplicated', async () => {
  const { stderr, buildTree } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { tags: ['shared'] }, () => {
        test('test 1', { tags: ['shared', 'unique'] }, () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'shared' },
          { name: 'unique' },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  expect(getTestTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "suite": {
          "test 1": [
            "shared",
            "unique",
          ],
        },
      },
    }
  `)
})

test('empty tags array on test is handled correctly', async () => {
  const { stderr, buildTree } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: [] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [{ name: 'unused' }],
      },
    },
  })
  expect(stderr).toBe('')
  expect(getTestTree(buildTree)).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": [],
      },
    }
  `)
})

test('filters tests with complex AND/OR expressions', async () => {
  const { stderr, testTree } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['unit', 'fast'] }, () => {})
      test('test 2', { tags: ['unit', 'slow'] }, () => {})
      test('test 3', { tags: ['e2e', 'fast'] }, () => {})
      test('test 4', { tags: ['e2e', 'slow'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'unit' },
          { name: 'e2e' },
          { name: 'fast' },
          { name: 'slow' },
        ],
      },
    },
  }, {
    tagsFilter: ['(unit || e2e) && fast'],
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": "passed",
        "test 2": "skipped",
        "test 3": "passed",
        "test 4": "skipped",
      },
    }
  `)
})

test('filters tests with NOT and parentheses', async () => {
  const { stderr, testTree } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['browser', 'chrome'] }, () => {})
      test('test 2', { tags: ['browser', 'firefox'] }, () => {})
      test('test 3', { tags: ['browser', 'edge'] }, () => {})
      test('test 4', { tags: ['node'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'browser' },
          { name: 'chrome' },
          { name: 'firefox' },
          { name: 'edge' },
          { name: 'node' },
        ],
      },
    },
  }, {
    tagsFilter: ['browser && !(edge)'],
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": "passed",
        "test 2": "passed",
        "test 3": "skipped",
        "test 4": "skipped",
      },
    }
  `)
})

test('throws an error when several tags with the same name are defined', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.js': `
      test('test 1', () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'duplicate', timeout: 1000 },
          { name: 'unique' },
          { name: 'duplicate', timeout: 2000 },
        ],
      },
    },
  }, {}, { fails: true })
  expect(stderr).toContain('Tag name "duplicate" is already defined in "test.tags". Tag names must be unique.')
})

test('multiple filter expressions act as AND', async () => {
  const { stderr, testTree } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['unit', 'fast'] }, () => {})
      test('test 2', { tags: ['unit', 'slow'] }, () => {})
      test('test 3', { tags: ['e2e', 'fast'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'unit' },
          { name: 'e2e' },
          { name: 'fast' },
          { name: 'slow' },
        ],
      },
    },
  }, {
    tagsFilter: ['unit || e2e', '!slow'],
  })
  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "test 1": "passed",
        "test 2": "skipped",
        "test 3": "passed",
      },
    }
  `)
})

test('tags can define meta in config', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test 1', { tags: ['unit'] }, () => {})
      test('test 2', { tags: ['e2e'] }, () => {})
      test('test 3', { tags: ['unit', 'slow'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'unit', meta: { type: 'unit', priority: 1 } },
          { name: 'e2e', meta: { type: 'e2e', browser: true } },
          { name: 'slow', meta: { priority: 2, slow: true } },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const [test1, test2, test3] = testModule.children.array() as TestCase[]
  expect(test1.meta()).toMatchInlineSnapshot(`
    {
      "priority": 1,
      "type": "unit",
    }
  `)
  expect(test2.meta()).toMatchInlineSnapshot(`
    {
      "browser": true,
      "type": "e2e",
    }
  `)
  expect(test3.meta()).toMatchInlineSnapshot(`
    {
      "priority": 2,
      "slow": true,
      "type": "unit",
    }
  `)
})

test('tag meta is inherited by suite and test meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      describe('suite', { tags: ['suite-tag'], meta: { suiteOwn: true } }, () => {
        test('test', { tags: ['test-tag'], meta: { testOwn: true } }, () => {})
      })
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'suite-tag', meta: { fromSuiteTag: 'value' } },
          { name: 'test-tag', meta: { fromTestTag: 'value' } },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const suite = testModule.children.at(0) as TestSuite
  const testCase = suite.children.at(0) as TestCase
  // suite has a tag with metadata, but tags are only applied to tests,
  // so suites don't get tag metadata
  expect(suite.meta()).toMatchInlineSnapshot(`
    {
      "suiteOwn": true,
    }
  `)
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "fromSuiteTag": "value",
      "fromTestTag": "value",
      "suiteOwn": true,
      "testOwn": true,
    }
  `)
})

test('test meta overrides tag meta', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test', { tags: ['tagged'], meta: { key: 'fromTest', testOnly: true } }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'tagged', meta: { key: 'fromTag', tagOnly: true } },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "key": "fromTest",
      "tagOnly": true,
      "testOnly": true,
    }
  `)
})

test('multiple tags with meta are merged with priority order', async () => {
  const { stderr, ctx } = await runInlineTests({
    'basic.test.js': `
      test('test', { tags: ['low', 'high'] }, () => {})
    `,
    'vitest.config.js': {
      test: {
        globals: true,
        tags: [
          { name: 'low', priority: 2, meta: { shared: 'low', lowOnly: true } },
          { name: 'high', priority: 1, meta: { shared: 'high', highOnly: true } },
        ],
      },
    },
  })
  expect(stderr).toBe('')
  const testModule = ctx!.state.getTestModules()[0]
  const testCase = testModule.children.at(0) as TestCase
  expect(testCase.meta()).toMatchInlineSnapshot(`
    {
      "highOnly": true,
      "lowOnly": true,
      "shared": "high",
    }
  `)
})

function getTestTree(builder: (fn: (test: TestCase) => any) => any) {
  return builder(test => test.options.tags)
}

function buildOptionsTree(builder: (fn: (test: TestCase) => any) => any) {
  return builder(test => removeUndefined(test.options))
}

function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

declare module 'vitest' {
  interface TaskMeta {
    type?: string
    priority?: number
    browser?: boolean
    slow?: boolean
    fromSuiteTag?: string
    fromTestTag?: string
    suiteOwn?: boolean
    testOwn?: boolean
    tagOnly?: boolean
    shared?: string
    lowOnly?: boolean
    highOnly?: boolean
  }
}
