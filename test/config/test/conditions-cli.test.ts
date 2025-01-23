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
  }, [], 'test', {
    define: {
      TEST_CONDITION: '"development"',
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
  }, [], 'test', {
    define: {
      TEST_CONDITION: '"production"',
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
  }, [], 'test', {
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
