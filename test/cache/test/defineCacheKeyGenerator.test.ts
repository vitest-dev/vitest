import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('if no cache key generator is defined, the hash is invalid', async () => {
  process.env.REPLACED = 'value1'

  const { errorTree: errorTree1 } = await runVitest({
    root: './fixtures/dynamic-cache-key',
    config: './vitest.config.fails.js',
    experimental: {
      fsModuleCache: true,
    },
    reporters: [
      {
        async onInit(vitest) {
          // make sure cache is empty
          await vitest.experimental_clearCache()
        },
      },
    ],
  })

  expect(errorTree1()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)

  process.env.REPLACED = 'value2'

  const { errorTree: errorTree2 } = await runVitest({
    root: './fixtures/dynamic-cache-key',
    config: './vitest.config.fails.js',
    experimental: {
      fsModuleCache: true,
    },
  })

  expect(errorTree2()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": [
          "expected 'value1' to be 'value2' // Object.is equality",
        ],
      },
    }
  `)
})

test('if cache key generator is defined, the hash is valid', async () => {
  process.env.REPLACED = 'value1'

  const { errorTree: errorTree1 } = await runVitest({
    root: './fixtures/dynamic-cache-key',
    config: './vitest.config.passes.js',
    experimental: {
      fsModuleCache: true,
    },
    reporters: [
      {
        async onInit(vitest) {
          // make sure cache is empty
          await vitest.experimental_clearCache()
        },
      },
    ],
  })

  expect(errorTree1()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)

  process.env.REPLACED = 'value2'

  const { errorTree: errorTree2 } = await runVitest({
    root: './fixtures/dynamic-cache-key',
    config: './vitest.config.passes.js',
    experimental: {
      fsModuleCache: true,
    },
  })

  expect(errorTree2()).toMatchInlineSnapshot(`
    {
      "replaced.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)
})
