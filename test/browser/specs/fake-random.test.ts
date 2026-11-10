import type { TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { provider, runInlineBrowserTests } from './utils'

function testValues(modules: TestModule[]) {
  return Object.fromEntries(
    modules.map((module) => [
      module.project.name,
      [...module.children.allTests()][0].meta().values,
    ]),
  )
}

// the seed depends on the file path and the test name, so both runs get the same values
function cartFile(setup: string) {
  return {
    'cart.test.js': /* js */ `
      import { test, vi } from 'vitest'
      import { cdp, page } from 'vitest/browser'

      test('adds an item to the cart', async ({ task }) => {
        vi.useFakeRandom()
        ${setup}
        document.body.innerHTML = '<button>Add</button>'
        // the trace view records the click
        await page.getByRole('button').click()
        task.meta.values = [Math.random(), crypto.randomUUID()]
        vi.useRealRandom()
      })
    `,
  }
}

test('the trace view does not take values from the fake', async () => {
  const untraced = await runInlineBrowserTests(cartFile(''), { browser: { traceView: 'off' } })
  // the default mode, 'failure-only', records every test
  const traced = await runInlineBrowserTests(cartFile(''))
  expect(untraced.stderr).toReportNoErrors()
  expect(traced.stderr).toReportNoErrors()
  expect(testValues(traced.results)).toEqual(testValues(untraced.results))
})

test.runIf(provider.name === 'playwright')(
  'cdp listeners do not take values from the fake',
  async () => {
    const config = { browser: { instances: [{ browser: 'chromium' as const }] } }
    const plain = await runInlineBrowserTests(cartFile(''), config)
    const listening = await runInlineBrowserTests(
      cartFile(`cdp().on('Runtime.consoleAPICalled', () => {})`),
      config,
    )
    expect(plain.stderr).toReportNoErrors()
    expect(listening.stderr).toReportNoErrors()
    expect(testValues(listening.results)).toEqual(testValues(plain.results))
  },
)

test('fakeRandom replaces the functions before the test file loads', async () => {
  const files = {
    // keeps a reference when it loads, as lodash does
    'dice.js': /* js */ `
      const nativeRandom = Math.random
      export const roll = () => Math.floor(nativeRandom() * 6) + 1
    `,
    'dice.test.js': /* js */ `
      import { test } from 'vitest'
      import { roll } from './dice.js'

      test('rolls the dice', ({ task }) => {
        task.meta.values = [roll(), roll(), roll()]
      })
    `,
  }
  const first = await runInlineBrowserTests(files, { fakeRandom: true })
  const second = await runInlineBrowserTests(files, { fakeRandom: true })
  expect(first.stderr).toReportNoErrors()
  expect(second.stderr).toReportNoErrors()
  expect(testValues(second.results)).toEqual(testValues(first.results))
})
