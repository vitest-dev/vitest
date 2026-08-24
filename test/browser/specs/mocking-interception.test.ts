import { expect, onTestFailed, test } from 'vitest'
import { runVitestCli } from '../../test-utils'
import { instances } from '../settings'

// mock routes are unrouted between test files, which toggles Chromium's request
// interception on and off around every file with mocks — the race window behind
// #8339. With the anchor route the interception must stay enabled for the whole
// run: no Fetch.disable and exactly one Fetch.enable. Firefox and WebKit never
// use the CDP Fetch domain, so only the run's health is asserted there.
test.each(instances)('$browser - request interception is not toggled between files', async ({ browser }) => {
  const { exitCode, stdout, stderr } = await runVitestCli({
    nodeOptions: {
      env: {
        DEBUG: 'pw:protocol',
        PROVIDER: 'playwright',
        TEST_BROWSER: browser,
        BROWSER_NO_WEBKIT: 'true',
      },
    },
  }, '--no-watch', '--root', 'fixtures/mock-stress')

  onTestFailed(() => {
    console.error(stdout)
    console.error(stderr)
  })

  // the inner run must exit 0 with every file executed; the CLI report format
  // differs from the API reporter (`✓  chromium  file`), so match the summary
  expect(exitCode).toBe(0)
  expect(stdout).toContain('Test Files  10 passed')
  expect(stdout).toContain('stress-1.test.ts')
  expect(stdout).toContain('stress-10.test.ts')

  if (browser !== 'chromium') {
    return
  }

  // the protocol log arrives on stderr
  const toggles = [...(stderr.match(/"(?:Fetch\.enable|Fetch\.disable)"/g) ?? [])]
  const enables = toggles.filter(t => t === '"Fetch.enable"')
  const disables = toggles.filter(t => t === '"Fetch.disable"')

  expect(disables).toHaveLength(0)
  expect(enables).toHaveLength(1)
})
