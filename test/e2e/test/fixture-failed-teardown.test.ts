import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('fixture teardown error is reported once and other teardowns still run', async () => {
  const { stdout, errorTree } = await runInlineTests({
    'basic.test.ts': `
      import { test as base } from 'vitest'

      const test = base.extend({
        server: async ({}, use) => {
          await use('server')
          console.log('>> close server')
        },
        client: async ({ server }, use) => {
          await use(server + ' client')
          console.log('>> close client')
          throw new Error('client teardown failed')
        },
      })

      test('teardown fails', ({ client }) => {})

      test('test and teardown fail', ({ client }) => {
        throw new Error('test failed')
      })
    `,
  })

  expect(getLogs(stdout)).toMatchInlineSnapshot(`
    ">> close client
    >> close server
    >> close client
    >> close server"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "teardown fails": [
          "client teardown failed",
        ],
        "test and teardown fail": [
          "test failed",
          "client teardown failed",
        ],
      },
    }
  `)
})

test('every failed fixture teardown is reported', async () => {
  const { stdout, errorTree } = await runInlineTests({
    'basic.test.ts': `
      import { test as base } from 'vitest'

      const test = base.extend({
        server: async ({}, use) => {
          await use('server')
          console.log('>> close server')
          throw new Error('server teardown failed')
        },
        client: async ({ server }, use) => {
          await use(server + ' client')
          console.log('>> close client')
          throw new Error('client teardown failed')
        },
      })

      test('both teardowns fail', ({ client }) => {})
    `,
  })

  expect(getLogs(stdout)).toMatchInlineSnapshot(`
    ">> close client
    >> close server"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "both teardowns fail": [
          "client teardown failed",
          "server teardown failed",
        ],
      },
    }
  `)
})

test('fixture teardown error of a failed attempt does not fail the retry', async () => {
  const { stderr, errorTree } = await runInlineTests({
    'fixture.ts': `
      import { test as base } from 'vitest'

      let teardowns = 0

      export const test = base.extend({
        db: async ({}, use) => {
          await use('db')
          teardowns++
          if (teardowns === 1) {
            throw new Error('db teardown failed')
          }
        },
      })
    `,
    'test.test.ts': `
      import { test } from './fixture.ts'

      test('test', { retry: 1 }, ({ db }) => {})
    `,
    'around-each.test.ts': `
      import { test } from './fixture.ts'

      test.aroundEach(async (runTest, { db }) => {
        await runTest()
      })

      test('test', { retry: 1 }, () => {})
    `,
  })

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "around-each.test.ts": {
        "test": "passed",
      },
      "test.test.ts": {
        "test": "passed",
      },
    }
  `)
})

const serverAndClientFiles = (fail: boolean) => ({
  'basic.test.ts': `
    import { test as base } from 'vitest'

    const test = base.extend({
      server: [
        async ({}, use) => {
          await use('server')
          console.log('>> close server')
          await new Promise((resolve) => setTimeout(resolve, 10))
          console.log('>> server closed')
          ${fail ? "throw new Error('server teardown failed')" : ''}
        },
        { scope: 'file' },
      ],
    })

    const clientTest = base.extend({
      client: [
        async ({}, use) => {
          await use('client')
          console.log('>> close client')
          await new Promise((resolve) => setTimeout(resolve, 10))
          console.log('>> client closed')
          ${fail ? "throw new Error('client teardown failed')" : ''}
        },
        { scope: 'file' },
      ],
    })

    test('starts the server', ({ server }) => {})
    clientTest('starts the client', ({ client }) => {})
  `,
})

test('file fixtures of different test.extend calls tear down one at a time', async () => {
  const { stdout, stderr } = await runInlineTests(serverAndClientFiles(false))

  expect(stderr).toBe('')
  expect(getLogs(stdout)).toMatchInlineSnapshot(`
    ">> close client
    >> client closed
    >> close server
    >> server closed"
  `)
})

test('every failed teardown of file fixtures of different test.extend calls is reported', async () => {
  const { errorTree } = await runInlineTests(serverAndClientFiles(true))

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "__module_errors__": [
          "client teardown failed",
          "server teardown failed",
        ],
        "starts the client": "passed",
        "starts the server": "passed",
      },
    }
  `)
})

function getLogs(stdout: string) {
  return stdout
    .split('\n')
    .filter((line) => line.startsWith('>>'))
    .join('\n')
}
