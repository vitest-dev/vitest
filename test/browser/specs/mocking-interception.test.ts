import { expect, onTestFailed, test } from 'vitest'
import { runVitestCli } from '../../test-utils'
import { instances } from '../settings'

// every file with mocks arms the request interception before its imports are
// released and disarms it when its last mock route is removed at teardown, so
// the interception never leaks into files without mocks — and the #8339 race
// window (Fetch.enable acknowledged before the interception is live) is closed
// by the probe roundtrip. Firefox and WebKit never use the CDP Fetch domain,
// so only the run's health is asserted there.
test.each(instances)('$browser - request interception is armed and disarmed per file with mocks', async ({ browser }) => {
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
  expect(stdout).toContain('Test Files  11 passed')
  expect(stdout).toContain('stress-1.test.ts')
  expect(stdout).toContain('stress-10.test.ts')
  expect(stdout).toContain('zz-plain.test.ts')

  if (browser !== 'chromium') {
    return
  }

  // the protocol log arrives on stderr; each mock file toggles the Fetch
  // domain exactly once per arm cycle and the file without mocks must not
  // produce a single paused request
  const toggles = [...(stderr.match(/"(?:Fetch\.enable|Fetch\.disable)"/g) ?? [])]
  const enables = toggles.filter(t => t === '"Fetch.enable"')
  const disables = toggles.filter(t => t === '"Fetch.disable"')

  expect(enables).toHaveLength(10)
  expect(disables).toHaveLength(10)
  expect(stderr.match(/"Fetch\.requestPaused"[^\n]*__vitest_non_mock_probe__/g)).toBe(null)

  // the durable guard that the arm barrier ran at all: a mutant removing
  // armInterception keeps enables/disables untouched, but leaves the probe
  // roundtrips missing; exactly one paused probe per armed file (INV-6)
  expect(stderr.match(/"Fetch\.requestPaused"[^\n]*__vitest_interception_probe__/g)).toHaveLength(10)
})
