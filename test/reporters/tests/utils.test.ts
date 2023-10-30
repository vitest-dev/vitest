/**
 * @format
 */
import { resolve } from 'pathe'
import type { ViteNodeRunner } from 'vite-node/client'
import { describe, expect, test } from 'vitest'
import { createReporters } from '../../../packages/vitest/src/node/reporters/utils'
import { DefaultReporter } from '../../../packages/vitest/src/node/reporters/default'
import TestReporter from '../src/custom-reporter'

const customReporterPath = resolve(__dirname, '../src/custom-reporter.js')
const fetchModule = {
  executeId: (id: string) => import(id),
} as ViteNodeRunner

describe('Reporter Utils', () => {
  test('passing an empty array returns nothing', async () => {
    const promisedReporters = await createReporters([], fetchModule)
    expect(promisedReporters).toHaveLength(0)
  })

  test('passing the name of a single built-in reporter returns a new instance', async () => {
    const promisedReporters = await createReporters(['default'], fetchModule)
    expect(promisedReporters).toHaveLength(1)
    const reporter = promisedReporters[0]
    expect(reporter).toBeInstanceOf(DefaultReporter)
  })

  test('passing in the path to a custom reporter returns a new instance', async () => {
    const promisedReporters = await createReporters(([customReporterPath]), fetchModule)
    expect(promisedReporters).toHaveLength(1)
    const customReporter = promisedReporters[0]
    expect(customReporter).toBeInstanceOf(TestReporter)
  })

  test('passing in a mix of built-in and custom reporters works', async () => {
    const promisedReporters = await createReporters(['default', customReporterPath], fetchModule)
    expect(promisedReporters).toHaveLength(2)
    const defaultReporter = promisedReporters[0]
    expect(defaultReporter).toBeInstanceOf(DefaultReporter)
    const customReporter = promisedReporters[1]
    expect(customReporter).toBeInstanceOf(TestReporter)
  })
})
