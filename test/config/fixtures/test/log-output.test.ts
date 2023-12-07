import { test } from 'vitest'
import type { UserConfig } from 'vitest/config'

/* eslint-disable no-console, unused-imports/no-unused-vars */

test('logs resolved configuration', async () => {
  // @ts-expect-error -- internal
  const { snapshotOptions, ...config }: UserConfig['test'] = globalThis.__vitest_worker__.config

  // Log options that are tested
  log('coverage.enabled', config.coverage?.enabled)

  if(config.coverage?.provider === "istanbul" || config.coverage?.provider === "v8")
    log('coverage.all', config.coverage?.all)
})

function log(label: string, value: unknown) {
  console.log(label, value, typeof value)
}
