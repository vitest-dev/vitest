import { expect, test } from 'vitest'
import { runInlineTests as base } from '../../test-utils'

test('timeout leak in test file', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leaking timeout', () => {
        setTimeout(() => {}, 100_000)
      })
    `,
  })

  expect(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    Timeout leaking in packages/example/test/example.test.ts
      1|
      2|       test('leaking timeout', () => {
      3|         setTimeout(() => {}, 100_000)
       |         ^
      4|       })
      5|
     ❯ packages/example/test/example.test.ts:3:9

    "
  `)
})

test('timeout leak in source file', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      import source from '../src/source'

      test('leaking timeout', () => {
        source()
      })
    `,
    'packages/example/src/source.ts': `
      export default function source() {
        setTimeout(() => {}, 100_000)
      }
    `,
  })

  expect(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    Timeout leaking in packages/example/test/example.test.ts
      1|
      2|       export default function source() {
      3|         setTimeout(() => {}, 100_000)
       |         ^
      4|       }
      5|
     ❯ source packages/example/src/source.ts:3:9
     ❯ packages/example/test/example.test.ts:5:9

    "
  `)
})

test('interval leak in test file', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leaking interval', () => {
        setInterval(() => {}, 100_000)
      })
    `,
  })

  expect(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    Timeout leaking in packages/example/test/example.test.ts
      1|
      2|       test('leaking interval', () => {
      3|         setInterval(() => {}, 100_000)
       |         ^
      4|       })
      5|
     ❯ packages/example/test/example.test.ts:3:9

    "
  `)
})

test('fs handle leak in test file', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      import { readFile } from 'node:fs'

      test('leaking fs handle', () => {
        readFile(import.meta.filename, () => {});
      })
    `,
  })

  expect(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    FSREQCALLBACK leaking in packages/example/test/example.test.ts
      3|
      4|       test('leaking fs handle', () => {
      5|         readFile(import.meta.filename, () => {});
       |         ^
      6|       })
      7|
     ❯ packages/example/test/example.test.ts:5:9

    "
  `)
})

test('leaking server', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
    import { Server } from "http";

      test('leaking tcp socket', () => {
        const app = new Server();
        app.listen({ host: "localhost", port: 0 });
      })
    `,
  })

  expect(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    GETADDRINFOREQWRAP leaking in packages/example/test/example.test.ts
      4|       test('leaking tcp socket', () => {
      5|         const app = new Server();
      6|         app.listen({ host: "localhost", port: 0 });
       |             ^
      7|       })
      8|
     ❯ packages/example/test/example.test.ts:6:13

    "
  `)
})

async function runInlineTests(...params: Parameters<typeof base>) {
  const result = await base(params[0], { globals: true, detectAsyncLeaks: true, ...params[1] }, params[2])

  return { ...result, stderr: trimWhitespace(result.stderr) }
}

function trimWhitespace(value: string) {
  return value
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, ''))
    .join('\n')
}
