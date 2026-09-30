import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

// Windows does not allow a colon in a file name
test.skipIf(process.platform === 'win32')(
  'web environment imports a module whose path contains a colon',
  async () => {
    const { stderr, testTree } = await runInlineTests(
      {
        'src/route:name/index.ts': `export const name = 'route'`,
        'basic.test.ts': /* ts */ `
          import { expect, test } from 'vitest'
          import { name } from './src/route:name/index.ts'

          test('imports the module', () => {
            expect(name).toBe('route')
          })
        `,
      },
      { environment: 'jsdom' },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "imports the module": "passed",
        },
      }
    `)
  },
)
