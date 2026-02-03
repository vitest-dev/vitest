import { expect, test } from 'vitest'
import { runInlineTests as base } from '../../test-utils'

test('does not report leaks when disabled', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leaking timeout', () => {
        setTimeout(() => {}, 100_000)
      })
    `,
  }, {
    detectAsyncLeaks: false,
  })

  expect.soft(stdout).not.toContain('Leak')
  expect.soft(stderr).toBe('')
})

test('timeout leak in test file', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leaking timeout', () => {
        setTimeout(() => {}, 100_000)
      })
    `,
  })

  expect.soft(stdout).toContain('Leaks  1 leak')

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

  expect.soft(stdout).toContain('Leaks  1 leak')

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

test('multiple leaks', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      import source from '../src/source'

      test('leaking timeout', () => {
        source()
        setTimeout(() => {}, 100_000)
      })
    `,
    'packages/example/src/source.ts': `
      export default function source() {
        setTimeout(() => {}, 100_000)
      }
    `,
  })

  expect.soft(stdout).toContain('Leaks  2 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 2 ⎯⎯⎯⎯⎯⎯⎯⎯

    Timeout leaking in packages/example/test/example.test.ts
      1|
      2|       export default function source() {
      3|         setTimeout(() => {}, 100_000)
       |         ^
      4|       }
      5|
     ❯ source packages/example/src/source.ts:3:9
     ❯ packages/example/test/example.test.ts:5:9

    Timeout leaking in packages/example/test/example.test.ts
      4|       test('leaking timeout', () => {
      5|         source()
      6|         setTimeout(() => {}, 100_000)
       |         ^
      7|       })
      8|
     ❯ packages/example/test/example.test.ts:6:9

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

  expect.soft(stdout).toContain('Leaks  1 leak')

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

  expect.soft(stdout).toContain('Leaks  1 leak')

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

      test('leaking tcp socket', async () => {
        const app = new Server();
        await new Promise(resolve => app.listen({ host: "localhost", port: 0 }, resolve));
      })
    `,
  })

  expect.soft(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    TCPSERVERWRAP leaking in packages/example/test/example.test.ts
      4|       test('leaking tcp socket', async () => {
      5|         const app = new Server();
      6|         await new Promise(resolve => app.listen({ host: "localhost", port:…
       |                                          ^
      7|       })
      8|
     ❯ packages/example/test/example.test.ts:6:42
     ❯ packages/example/test/example.test.ts:6:15

    "
  `)
})

test('leak in project setup', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/first/test/example-1.test.ts': `
      import { test } from 'vitest';

      test('leaking timeout', () => {
        setTimeout(() => {}, 100_000)
      })
    `,
    'packages/second/test/example-2.test.ts': `
      import { test } from 'vitest';
      import source from '../src/source'

      test('leaking timeout', () => {
        source()
      })
    `,
    'packages/second/src/source.ts': `
      export default function source() {
        setTimeout(() => {}, 100_000)
      }
    `,
  }, { projects: ['packages/*'] })

  expect.soft(stdout).toContain('Leaks  2 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 2 ⎯⎯⎯⎯⎯⎯⎯⎯

    Timeout leaking in packages/first/test/example-1.test.ts
      3|
      4|       test('leaking timeout', () => {
      5|         setTimeout(() => {}, 100_000)
       |         ^
      6|       })
      7|
     ❯ test/example-1.test.ts:5:9

    Timeout leaking in packages/second/test/example-2.test.ts
      1|
      2|       export default function source() {
      3|         setTimeout(() => {}, 100_000)
       |         ^
      4|       }
      5|
     ❯ source src/source.ts:3:9
     ❯ test/example-2.test.ts:6:9

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
