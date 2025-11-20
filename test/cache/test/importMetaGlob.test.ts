import { expect, test } from 'vitest'
import { runVitest, useFS } from '../../test-utils'

test('if file has import.meta.glob, it\'s not cached', async () => {
  const { createFile } = useFS('./fixtures/import-meta-glob/generated', {
    1: '1',
    2: '2',
  }, false)

  const { errorTree: errorTree1 } = await runVitest({
    root: './fixtures/import-meta-glob',
    provide: {
      generated: ['./generated/1', './generated/2'],
    },
    experimental: {
      fsModuleCache: true,
      fsModuleCachePath: './node_modules/.vitest-fs-cache',
    },
  })

  expect(errorTree1()).toMatchInlineSnapshot(`
    {
      "glob.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)

  createFile('3', '3')

  const { errorTree: errorTree2 } = await runVitest({
    root: './fixtures/import-meta-glob',
    provide: {
      generated: [
        './generated/1',
        './generated/2',
        './generated/3',
      ],
    },
    experimental: {
      fsModuleCache: true,
      fsModuleCachePath: './node_modules/.vitest-fs-cache',
    },
  })

  expect(errorTree2()).toMatchInlineSnapshot(`
    {
      "glob.test.js": {
        "replaced variable is the same": "passed",
      },
    }
  `)
})

declare module 'vitest' {
  export interface ProvidedContext {
    generated: string[]
  }
}
