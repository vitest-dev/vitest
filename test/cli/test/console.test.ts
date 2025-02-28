import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { DefaultReporter } from 'vitest/reporters'
import { runVitest } from '../../test-utils'

test('can run custom pools with Vitest', async () => {
  const reporter = new DefaultReporter()
  const vitest = await runVitest({
    root: './fixtures/console',
    reporters: [
      {
        onInit(ctx) {
          reporter.onInit(ctx as any)
        },
        onUserConsoleLog(ctx) {
          reporter.onUserConsoleLog(ctx)
        },
      },
    ],
  })
  // removed the banner with version and timestamp
  expect(vitest.stdout.split('\n').slice(2).join('\n')).toMatchInlineSnapshot(`
    "
    stdout | trace.test.ts > logging to stdout
    log with trace
     ❯ trace.test.ts:4:11

    stdout | trace.test.ts > logging to stdout
    info with trace
     ❯ trace.test.ts:5:11

    stdout | trace.test.ts > logging to stdout
    debug with trace
     ❯ trace.test.ts:6:11

    stdout | trace.test.ts > logging to stdout
    { hello: 'from dir with trace' }
     ❯ trace.test.ts:7:11

    "
  `)
  const stderrArray = vitest.stderr.split('\n')
  // remove stack trace
  const stderr = stderrArray.slice(0, -14).join('\n')
  const stackStderr = stderrArray.slice(-14).join('\n')
  expect(stderr).toMatchInlineSnapshot(`
    "stderr | trace.test.ts > logging to stdout
    warn with trace
     ❯ trace.test.ts:8:11

    stderr | trace.test.ts > logging to stdout
    Assertion failed: assert with trace
     ❯ trace.test.ts:9:11

    stderr | trace.test.ts > logging to stdout
    error with trace
     ❯ trace.test.ts:10:11
    "
  `)
  // shows built-in stack because we don't intercept it, but doesn't show the new one
  expect(stackStderr).toMatch('Trace: trace with trace')
  expect(stackStderr).toMatch('trace.test.ts:11:11')
  expect(stackStderr).toMatch('   at ')
  expect(stackStderr).not.toMatch('❯ ')
  if (process.platform !== 'win32') {
    const root = resolve(process.cwd(), '../..')
    const trace = stackStderr.replace(new RegExp(root, 'g'), '<root>').replace(/\d+:\d+/g, 'ln:cl').split('\n').slice(0, 3).join('\n')
    expect(trace).toMatchInlineSnapshot(`
      "stderr | trace.test.ts > logging to stdout
      Trace: trace with trace
          at <root>/test/cli/fixtures/console/trace.test.ts:ln:cl"
    `)
  }
})
