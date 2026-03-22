import { runVitest } from '#test-utils'
import { expect, test } from 'vitest'

test('optimize deps optimizes them into node_modules/.vite', async () => {
  const { errorTree, stderr } = await runVitest({
    root: './fixtures/optimize-deps',
    deps: {
      optimizer: {
        client: {
          enabled: true,
        },
        ssr: {
          enabled: true,
        },
      },
    },
    $viteConfig: {
      optimizeDeps: {
        include: ['@test/test-dep-url'],
      },
      ssr: {
        optimizeDeps: {
          include: ['@test/test-dep-url'],
        },
      },
    },
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "ssr.test.ts": {
        "import.meta.url": "passed",
      },
      "web.test.ts": {
        "import.meta.url": "passed",
      },
    }
  `)
})
