import { expect, test } from 'vitest'
import { runInlineTests as base } from '../../test-utils'

test('does not report leaks when disabled', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leaks', () => {
        setTimeout(() => {}, 100_000)
        setInterval(() => {}, 100_000)
        new Promise((resolve) => {})
      })
    `,
  }, {
    detectAsyncLeaks: false,
  })

  expect.soft(stdout).not.toContain('Leak')
  expect.soft(stderr).toBe('')
})

test('timeout', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      import source from '../src/source'

      test('leak in test file', () => {
        setTimeout(() => {}, 100_000)
      })

      test('leak in separate file', () => {
        source()
      })

      test('not a leak', () => {
        const timeout = setTimeout(() => {}, 100_000)
        clearTimeout(timeout)
      })
    `,
    'packages/example/src/source.ts': `
      export default function execute() {
        setTimeout(() => {}, 100_000)
      }
    `,
  })

  expect.soft(stdout).toContain('Leaks  2 leaks')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 2 ⎯⎯⎯⎯⎯⎯⎯⎯

    Timeout leaking in packages/example/test/example.test.ts
      3|
      4|       test('leak in test file', () => {
      5|         setTimeout(() => {}, 100_000)
       |         ^
      6|       })
      7|
     ❯ packages/example/test/example.test.ts:5:9

    Timeout leaking in packages/example/test/example.test.ts
      1|
      2|       export default function execute() {
      3|         setTimeout(() => {}, 100_000)
       |         ^
      4|       }
      5|
     ❯ execute packages/example/src/source.ts:3:9
     ❯ packages/example/test/example.test.ts:9:9

    "
  `)
})

test('interval', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leak', () => {
        setInterval(() => {}, 100_000)
      })

      test('not a leak', () => {
        const interval = setInterval(() => {}, 100_000)
        clearInterval(interval)
      })
    `,
  })

  expect.soft(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    Timeout leaking in packages/example/test/example.test.ts
      1|
      2|       test('leak', () => {
      3|         setInterval(() => {}, 100_000)
       |         ^
      4|       })
      5|
     ❯ packages/example/test/example.test.ts:3:9

    "
  `)
})

test('promise', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('leak', () => {
        new Promise((resolve) => {})
      })

      test('nested leaks', () => {
        new Promise((resolve) => {
          new Promise((resolve2) => {})
        })
      })

      test('not a leak', () => {
        new Promise((resolve) => resolve())
        new Promise((resolve, reject) => reject()).catch(() => {})
      })
    `,
  })

  expect.soft(stdout).toContain('Leaks  3 leaks')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 3 ⎯⎯⎯⎯⎯⎯⎯⎯

    PROMISE leaking in packages/example/test/example.test.ts
      1|
      2|       test('leak', () => {
      3|         new Promise((resolve) => {})
       |         ^
      4|       })
      5|
     ❯ packages/example/test/example.test.ts:3:9

    PROMISE leaking in packages/example/test/example.test.ts
      5|
      6|       test('nested leaks', () => {
      7|         new Promise((resolve) => {
       |         ^
      8|           new Promise((resolve2) => {})
      9|         })
     ❯ packages/example/test/example.test.ts:7:9

    PROMISE leaking in packages/example/test/example.test.ts
      6|       test('nested leaks', () => {
      7|         new Promise((resolve) => {
      8|           new Promise((resolve2) => {})
       |           ^
      9|         })
     10|       })
     ❯ packages/example/test/example.test.ts:8:11
     ❯ packages/example/test/example.test.ts:7:9

    "
  `)
})

test('fetch', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      test('not a leak', async () => {
        await fetch('https://vitest.dev').then(response => response.text())
      })
    `,

    'packages/example/test/example-2.test.ts': `
      import { createServer } from "node:http";

      let setConnected = () => {}
      let waitConnection = new Promise(resolve => (setConnected = resolve))

      beforeAll(async () => {
        const server = createServer((_, res) => {
          setConnected();
          setTimeout(() => res.end("Hello after 10 seconds!"), 10_000).unref();
        });
        await new Promise((resolve) => server.listen(5179, resolve));
        return () => server.close();
      });

      test("is a leak", async () => {
        fetch('http://localhost:5179');
        await waitConnection;
      });
    `,
  })

  expect.soft(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    PROMISE leaking in packages/example/test/example-2.test.ts
     15|
     16|       test("is a leak", async () => {
     17|         fetch('http://localhost:5179');
       |         ^
     18|         await waitConnection;
     19|       });
     ❯ packages/example/test/example-2.test.ts:17:9

    "
  `)
})

test('fs handle', async () => {
  const { stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      import { readFile } from 'node:fs'

      test('leaking fs handle', () => {
        readFile(import.meta.filename, () => {});
      })
    `,
    'packages/example/test/example-2.test.ts': `
      import { readFile } from 'node:fs'

      test('not a leak', async () => {
        await new Promise(resolve => readFile(import.meta.filename, () => { resolve() }));
      })
    `,
  })

  // This might be racy. Sometimes readFile fires two FSREQCALLBACK's, sometimes just one.
  expect(stderr).toContain(`\
FSREQCALLBACK leaking in packages/example/test/example.test.ts
  3|
  4|       test('leaking fs handle', () => {
  5|         readFile(import.meta.filename, () => {});
   |         ^
  6|       })
  7|
 ❯ packages/example/test/example.test.ts:5:9
`)
})

test('http server', async () => {
  const { stdout, stderr } = await runInlineTests({
    'packages/example/test/example.test.ts': `
      import { Server } from "http";

      test('leak', async () => {
        const app = new Server();
        await new Promise(resolve => app.listen({ host: "localhost", port: 0 }, resolve));
      })

      test('not a leak', async () => {
        const app = new Server();
        await new Promise(resolve => app.listen({ host: "localhost", port: 0 }, resolve));
        app.close()
      })
    `,
  })

  expect.soft(stdout).toContain('Leaks  1 leak')

  expect(stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Async Leaks 1 ⎯⎯⎯⎯⎯⎯⎯⎯

    TCPSERVERWRAP leaking in packages/example/test/example.test.ts
      4|       test('leak', async () => {
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
