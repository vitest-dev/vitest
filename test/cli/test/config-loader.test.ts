import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const isTypeStrippingSupported = !!process.features.typescript

test.runIf(isTypeStrippingSupported)('configLoader native', async () => {
  const { stderr, exitCode, ctx } = await runVitest({
    root: 'fixtures/config-loader',
    standalone: true,
    watch: true,
    $cliOptions: {
      configLoader: 'native',
    },
  })
  expect(ctx?.projects.map(p => p.name)).toMatchInlineSnapshot(`
    [
      "node",
      "browser (chromium)",
    ]
  `)
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})

test('configLoader runner', async () => {
  const { vitest, exitCode, ctx } = await runVitest({
    root: 'fixtures/config-loader',
    standalone: true,
    watch: true,
    $cliOptions: {
      configLoader: 'runner',
    },
  })
  expect(ctx?.projects.map(p => p.name)).toMatchInlineSnapshot(`
    [
      "node",
      "browser (chromium)",
    ]
  `)
  expect(vitest.stderr).toBe('')
  expect(exitCode).toBe(0)
})
