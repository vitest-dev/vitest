import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, onTestFinished, test } from 'vitest'
import { runVitest, runVitestCli } from '../../test-utils'

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

test('fails when explicit root does not exist', async () => {
  const missingRoot = resolve(import.meta.dirname, '..', 'not-existing-dir')

  rmSync(missingRoot, { recursive: true, force: true })
  onTestFinished(() => {
    rmSync(missingRoot, { recursive: true, force: true })
  })

  const { exitCode, stderr, stdout } = await runVitestCli(
    { nodeOptions: { cwd: resolve(import.meta.dirname, '..') } },
    '--root',
    missingRoot,
    '--run',
  )

  expect(exitCode).toBe(1)
  expect(stdout).toBe('')
  expect(stderr).toContain('Root directory does not exist')
})
