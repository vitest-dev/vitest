import { expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { provider, runBrowserTests } from './utils'

test('timeout settings', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/timeout',
  })
  expect(stderr).toContain('Matcher did not succeed in time.')
  if (provider.name === 'playwright') {
    expect(stderr).toContain('locator.click: Timeout 500ms exceeded.')
    expect(stderr).toContain('locator.click: Timeout 345ms exceeded.')
  }
})

test.runIf(provider.name === 'playwright')('timeout hooks', async ({ onTestFailed }) => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/timeout-hooks',
  })

  onTestFailed(() => {
    console.error(stderr)
  })

  const lines = stderr.split('\n')
  const timeoutErrorsIndexes: number[] = []
  lines.forEach((line, index) => {
    if (line.includes('TimeoutError:')) {
      timeoutErrorsIndexes.push(index)
    }
  })

  const snapshot = timeoutErrorsIndexes.map((index) => {
    return [
      lines[index - 1],
      lines[index].replace(/Timeout \d+ms exceeded/, 'Timeout <ms> exceeded'),
      lines[index + 4],
    ].join('\n')
  }).sort().join('\n\n')

  // rolldown has better source maps
  if (rolldownVersion) {
    expect(snapshot).toMatchInlineSnapshot(`
      " FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:39:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:23:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:31:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:15:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:6:33

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:62:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:48:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:39:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:23:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:31:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:15:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:6:33

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:62:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:48:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:39:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:23:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:31:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:15:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:6:33

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:62:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:48:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47"
    `)
  }
  else {
    expect(snapshot).toMatchInlineSnapshot(`
      " FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:39:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:23:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:31:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:15:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:6:33

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:62:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:48:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:39:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:23:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:31:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:15:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:6:33

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:62:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:48:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:39:51

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:23:51

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:31:51

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:15:51

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:6:39

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:62:53

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:53

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:48:53

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:53"
    `)
  }

  // page.getByRole('code').click()
  expect(stderr).toContain('locator.click: Timeout')
  // playwright error is proxied from the server to the client and back correctly
  expect(stderr).toContain('waiting for locator(\'[data-vitest="true"]\').contentFrame().getByRole(\'code\')')
  expect(stderr).toMatch(/hooks-timeout.test.ts:6:(33|39)/)
  // await expect.element().toBeVisible()
  expect(stderr).toContain('Cannot find element with locator: getByRole(\'code\')')
  expect(stderr).toMatch(/hooks-timeout.test.ts:10:(49|61)/)
}, 120_000 * 3)
