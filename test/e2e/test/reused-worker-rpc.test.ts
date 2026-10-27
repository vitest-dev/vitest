import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, StableTestFileOrderSorter } from '../../test-utils'

// counts the worker's calls to the main process, by method
const runner = `
import { writeFileSync } from 'node:fs'
import { TestRunner } from 'vitest'

const calls = { fetchWarmModules: 0, files: 0 }
const counted = new WeakSet()

// every run request hands the worker a new state with its own rpc
function countRpc(workerState) {
  if (counted.has(workerState)) {
    return
  }
  counted.add(workerState)
  workerState.rpc = new Proxy(workerState.rpc, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      if (property === 'fetchWarmModules') {
        return (...args) => {
          calls.fetchWarmModules++
          return value.apply(target, args)
        }
      }
      return value
    },
  })
}

countRpc(globalThis.__vitest_worker__)

export default class CountingRunner extends TestRunner {
  onBeforeCollect(paths) {
    countRpc(globalThis.__vitest_worker__)
    return super.onBeforeCollect?.(paths)
  }

  async onAfterRunFiles(files) {
    await super.onAfterRunFiles?.(files)
    calls.files++
    writeFileSync(new URL(\`./rpc-calls-\${process.pid}.json\`, import.meta.url), JSON.stringify(calls))
  }
}
`

// with one worker every file arrives in a single run request; two workers
// receive the files one request at a time and keep their runners between them
test('a reused worker asks for the warm snapshot once', async () => {
  // every file imports a module of its own, so each of them fetches a
  // dependency the worker has not seen
  const testFile = (name: string) => `
import { expect, test } from 'vitest'
import { value } from './dep'
import { own } from './${name}-dep'

test('the setup mock applies', () => {
  expect(value).toBe('mocked')
  expect(own).toBe('${name}')
})
`
  const { stderr, root, testTree } = await runInlineTests(
    {
      'dep.ts': `export const value = 'original'`,
      'setup.ts': `
import { vi } from 'vitest'
vi.mock('./dep', () => ({ value: 'mocked' }))
`,
      'runner.ts': runner,
      'a-dep.ts': `export const own = 'a'`,
      'b-dep.ts': `export const own = 'b'`,
      'c-dep.ts': `export const own = 'c'`,
      'a.test.ts': testFile('a'),
      'b.test.ts': testFile('b'),
      'c.test.ts': testFile('c'),
    },
    {
      pool: 'forks',
      isolate: false,
      fileParallelism: true,
      maxWorkers: 2,
      minWorkers: 2,
      setupFiles: ['./setup.ts'],
      runner: './runner.ts',
      sequence: { sequencer: StableTestFileOrderSorter },
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "a.test.ts": {
        "the setup mock applies": "passed",
      },
      "b.test.ts": {
        "the setup mock applies": "passed",
      },
      "c.test.ts": {
        "the setup mock applies": "passed",
      },
    }
  `)

  const workers = readdirSync(root)
    .filter((name) => name.startsWith('rpc-calls-'))
    .map((name) => JSON.parse(readFileSync(join(root, name), 'utf-8')))
  expect(workers.reduce((sum, calls) => sum + calls.files, 0)).toBe(3)
  for (const calls of workers) {
    expect(calls.fetchWarmModules).toBe(1)
  }
})
