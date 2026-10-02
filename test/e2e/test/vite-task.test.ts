import { readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitestCli, useTmpFS } from '../../test-utils'

// Vite Task hands tools the path of its client addon through
// VP_RUN_NODE_CLIENT_PATH. This fake addon records every call instead.
const fakeAddon = `
const { appendFileSync } = require('node:fs')
const log = (kind, path) => appendFileSync(process.env.VITE_TASK_LOG, JSON.stringify([kind, path]) + '\\n')
exports.load = () => ({
  ignoreInput: path => log('input', path),
  ignoreOutput: path => log('output', path),
  disableCache: () => log('disableCache'),
  getEnv: () => undefined,
  getEnvs: () => ({}),
})
`

test('caches are ignored as inputs and outputs when run by Vite Task', async () => {
  const { root } = useTmpFS({
    'basic.test.ts': `test('basic', () => {})`,
    'vite-task-addon.cjs': fakeAddon,
    'vitest.config.js': {
      test: {
        globals: true,
        fsModuleCache: true,
        fsModuleCachePath: './node_modules/.custom-module-cache',
      },
    },
  })
  const logPath = resolve(root, 'vite-task.log')

  const { exitCode, stderr } = await runVitestCli(
    {
      nodeOptions: {
        env: {
          VP_RUN_NODE_CLIENT_PATH: resolve(root, 'vite-task-addon.cjs'),
          VITE_TASK_LOG: logPath,
        },
      },
    },
    'run',
    '--root',
    root,
  )

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const calls: [string, string][] = readFileSync(logPath, 'utf-8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  const ignored = (kind: string) =>
    calls.filter(([k]) => k === kind).map(([, path]) => resolve(path))

  const escapedRoot = resolve(root).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const resultsCache = expect.stringMatching(
    new RegExp(`^${escapedRoot}/node_modules/\\.vite/vitest/[0-9a-f]+/results\\.json$`),
  )
  const moduleCache = resolve(root, 'node_modules/.custom-module-cache')

  expect(ignored('input')).toEqual(expect.arrayContaining([resultsCache, moduleCache]))
  expect(ignored('output')).toEqual(expect.arrayContaining([resultsCache, moduleCache]))
})
