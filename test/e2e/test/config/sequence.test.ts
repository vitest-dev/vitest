import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test('per-project sequence options: override, inheritance, and shared seed', async () => {
  const { ctx, stderr } = await runInlineTests({
    'vitest.config.ts': {
      test: {
        sequence: { concurrent: false, hooks: 'list', setupFiles: 'list', seed: 123 },
        projects: [
          {
            test: {
              name: 'custom',
              include: ['a.test.ts'],
              sequence: { concurrent: true, hooks: 'stack', setupFiles: 'parallel', shuffle: { tests: true } },
            },
          },
          { test: { name: 'no-extends', include: ['a.test.ts'] } },
          { extends: true, test: { name: 'with-extends', include: ['a.test.ts'] } },
        ],
      },
    },
    'a.test.ts': /* ts */ `
      import { test } from 'vitest'
      test('example', () => {})
    `,
  })

  expect(stderr).toBe('')
  const pick = (name: string) => {
    const { concurrent, hooks, setupFiles, shuffle, seed } = ctx!.projects.find(p => p.name === name)!.serializedConfig.sequence
    return { concurrent, hooks, setupFiles, shuffle, seed }
  }
  expect({
    // a project's own `sequence` wins over the root config
    'custom': pick('custom'),
    // a bare inline project does not inherit the root `sequence`; it uses defaults
    'no-extends': pick('no-extends'),
    // `extends: true` inherits the root `sequence`
    'with-extends': pick('with-extends'),
  }).toMatchInlineSnapshot(`
    {
      "custom": {
        "concurrent": true,
        "hooks": "stack",
        "seed": 123,
        "setupFiles": "parallel",
        "shuffle": true,
      },
      "no-extends": {
        "concurrent": undefined,
        "hooks": "stack",
        "seed": 123,
        "setupFiles": undefined,
        "shuffle": undefined,
      },
      "with-extends": {
        "concurrent": false,
        "hooks": "list",
        "seed": 123,
        "setupFiles": "list",
        "shuffle": undefined,
      },
    }
  `)
})
