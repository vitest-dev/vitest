import { afterEach, expect, test, vi } from 'vitest'
import { getModuleGraph } from '../../../packages/vitest/src/utils/graph.js'
import { runInlineTests } from '../../test-utils'

afterEach(() => {
  vi.unstubAllEnvs()
})

test.for(['production', 'test'])(
  'node builtins are importable in the client environment when NODE_ENV=%s',
  async (nodeEnv) => {
    vi.stubEnv('NODE_ENV', nodeEnv)

    const { stderr, testTree, ctx, root } = await runInlineTests(
      {
        'client-env.js': `
export default {
  name: 'client-env',
  viteEnvironment: 'client',
  setup() {
    return { teardown() {} }
  },
}
`,
        'basic.test.js': `
import { timingSafeEqual } from 'node:crypto'
import * as nodePath from 'node:path'
import fs from 'fs'
import { expect, test } from 'vitest'

test('static imports', () => {
  expect(timingSafeEqual(Buffer.from('aa'), Buffer.from('aa'))).toBe(true)
  expect(nodePath.posix.join('a', 'b')).toBe('a/b')
  expect(fs.existsSync(import.meta.filename)).toBe(true)
})

test('dynamic imports', async () => {
  const os = await import('node:os')
  const { basename } = await import('path')
  expect(os.platform()).toBe(process.platform)
  expect(basename('/a/b.js')).toBe('b.js')
})
`,
        'mock.test.js': `
import os from 'os'
import { platform } from 'node:os'
import { readFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'

vi.mock('os')
vi.mock('node:fs', () => ({ readFileSync: () => 'mocked' }))

test('automock', () => {
  expect(vi.isMockFunction(os.platform)).toBe(true)
  expect(vi.isMockFunction(platform)).toBe(true)
})

test('factory', () => {
  expect(readFileSync('file')).toBe('mocked')
})

test('importActual', async () => {
  const actual = await vi.importActual('node:os')
  expect(actual.platform()).toBe(process.platform)
})
`,
      },
      { environment: './client-env.js' },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "dynamic imports": "passed",
          "static imports": "passed",
        },
        "mock.test.js": {
          "automock": "passed",
          "factory": "passed",
          "importActual": "passed",
        },
      }
    `)

    const graph = await getModuleGraph(ctx!, '', `${root}/basic.test.js`, 'client')
    const modules = Object.entries(graph.modules)
    const externalized = modules.filter(([, m]) => m.external).map(([id]) => id)
    const inlined = modules.filter(([, m]) => !m.external).map(([id]) => id)
    expect(externalized.filter((id) => !id.includes('/'))).toMatchInlineSnapshot(`
      [
        "node:crypto",
        "node:path",
        "fs",
        "node:os",
        "path",
      ]
    `)
    expect(inlined.map((id) => id.replace(root, '<root>'))).toMatchInlineSnapshot(`
      [
        "<root>/basic.test.js",
      ]
    `)
  },
)
