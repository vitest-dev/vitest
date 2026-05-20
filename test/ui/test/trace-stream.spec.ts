import type { Vitest } from 'vitest/node'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { resolve } from 'pathe'
import { getExplorerItem, startVitestUi } from './helper'

test.describe('trace stream', () => {
  let vitest: Vitest | undefined
  let baseURL: string

  const root = path.join(import.meta.dirname, '../fixtures/trace-stream')
  const gatesDir = path.join(root, 'node_modules/.vitest-e2e')

  test.beforeAll(async () => {
    await rm(gatesDir, { recursive: true, force: true })
    await mkdir(gatesDir, { recursive: true })

    // start standalone to hold off running tests
    const server = await startVitestUi(
      {
        root,
        watch: true,
        ui: true,
        open: false,
        standalone: true,
      },
      {
        define: {
          'import.meta.env.TEST_GATE_FILE': 'true',
        },
      },
    )
    vitest = server.vitest
    baseURL = `${server.url}/__vitest__/`
  })

  test.afterAll(async () => {
    await vitest?.close()
    await rm(gatesDir, { recursive: true, force: true })
  })

  test('basic', async ({ page }) => {
    await page.goto(baseURL)

    // start test
    const runPromise = vitest!.runTestSpecifications(
      await vitest!.globTestSpecifications(['basic.test.ts']),
    )

    const testItem = getExplorerItem(page, 'simple')
    await expect(testItem).toBeVisible()

    // click test case in explore to open trace view
    const traceView = page.getByTestId('trace-view')
    await expect(traceView).not.toBeVisible()
    await testItem.click()
    await expect(traceView).toBeVisible()

    const traceSteps = traceView.getByTestId('trace-step')
    const traceStepNames = traceView.getByTestId('trace-step-name')

    // traces progress up-to `render-a`
    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'render-a',
    ])

    // first step is selected by default
    await expect(traceSteps.nth(0)).toHaveAttribute('aria-current', 'step')

    // progresses up-to `render-b`
    await writeFile(resolve(gatesDir, 'b.txt'), 'open')
    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'render-a',
      'render-b',
    ])

    // select next step
    await traceStepNames.nth(1).click()
    await expect(traceSteps.nth(1)).toHaveAttribute('aria-current', 'step')

    // continue test and wait for finishes
    await writeFile(resolve(gatesDir, 'c.txt'), 'open')
    await runPromise
    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'render-a',
      'render-b',
      'render-c',
      'test finished',
    ])
    // last selected step is preserved
    await expect(traceSteps.nth(1)).toHaveAttribute('aria-current', 'step')

    // re-run and verify trace view is cleared
    await rm(gatesDir, { recursive: true, force: true })
    await mkdir(gatesDir, { recursive: true })
    const rerunPromise = vitest!.runTestSpecifications(
      await vitest!.globTestSpecifications(['basic.test.ts']),
    )
    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'render-a',
    ])
    await expect(traceSteps.nth(0)).toHaveAttribute('aria-current', 'step')
    await writeFile(resolve(gatesDir, 'b.txt'), 'open')
    await writeFile(resolve(gatesDir, 'c.txt'), 'open')
    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'render-a',
      'render-b',
      'render-c',
      'test finished',
    ])
    await rerunPromise
  })

  test('expect.element range', async ({ page }) => {
    await page.goto(baseURL)

    // start test
    const runPromise = vitest!.runTestSpecifications(
      await vitest!.globTestSpecifications(['range.test.ts']),
    )

    const testItem = getExplorerItem(page, 'expect')
    await expect(testItem).toBeVisible()

    const traceView = page.getByTestId('trace-view')
    await expect(traceView).not.toBeVisible()
    await testItem.click()
    await expect(traceView).toBeVisible()

    const traceSteps = traceView.getByTestId('trace-step')
    const traceStepNames = traceView.getByTestId('trace-step-name')

    // first expect.element range is shown as in-progress
    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'toBeVisible',
    ])
    await expect(traceSteps.nth(0)).toHaveAttribute('data-test-range', 'start')

    // completing the first gate resolves the first range
    await writeFile(resolve(gatesDir, 'expect-b.txt'), 'open')
    await expect(traceSteps.nth(0)).toHaveAttribute('data-test-range', 'end')

    // next expect.element range starts while polling continues
    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'toBeVisible',
      'toHaveAttribute',
    ])
    await expect(traceSteps.nth(1)).toHaveAttribute('data-test-range', 'start')

    // completing the final gate records the end marker and test result
    await writeFile(resolve(gatesDir, 'expect-c.txt'), 'open')
    await runPromise

    await expect.poll(() => traceStepNames.allInnerTexts()).toEqual([
      'toBeVisible',
      'toHaveAttribute',
      'test finished',
    ])
  })
})
