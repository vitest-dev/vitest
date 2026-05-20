import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

const configWithoutIsolation = `
import { defineConfig } from 'vitest/config'

class Sequencer {
  sort(files) { return files }
  shard(files) { return files }
}

export default defineConfig({
  test: {
    isolate: false,
    fileParallelism: false,
    sequence: { sequencer: Sequencer },
  },
})
`

test('factory mock then bare mock across files with isolate:false (#10290)', async () => {
  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': configWithoutIsolation,
    './src/repo.js': `
export function hasThing(name) {
  return false;
}
export function otherThing() {
  return 'real';
}
    `,
    './test/testA.test.ts': `
import { vi, test, expect } from 'vitest'
import * as repo from '../src/repo.js'

vi.mock('../src/repo.js', () => ({
  otherThing: vi.fn(() => 'mockedA'),
}))

test('factory mock works', () => {
  expect(repo.otherThing()).toBe('mockedA')
})
    `,
    './test/testB.test.ts': `
import { vi, test, expect } from 'vitest'
import * as repo from '../src/repo.js'

vi.mock('../src/repo.js')

test('bare mock should auto-mock hasThing', () => {
  vi.mocked(repo.hasThing).mockReturnValue(true)
  expect(repo.hasThing('anything')).toBe(true)
})
    `,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "test/testA.test.ts": {
        "factory mock works": "passed",
      },
      "test/testB.test.ts": {
        "bare mock should auto-mock hasThing": "passed",
      },
    }
  `)
})

test('bare mock then factory mock across files with isolate:false', async () => {
  const { stderr, testTree } = await runInlineTests({
    'vitest.config.js': configWithoutIsolation,
    './src/repo.js': `
export function hasThing(name) {
  return false;
}
export function otherThing() {
  return 'real';
}
    `,
    './test/testA.test.ts': `
import { vi, test, expect } from 'vitest'
import * as repo from '../src/repo.js'

vi.mock('../src/repo.js')

test('automock works first', () => {
  vi.mocked(repo.hasThing).mockReturnValue(true)
  expect(repo.hasThing('anything')).toBe(true)
})
    `,
    './test/testB.test.ts': `
import { vi, test, expect } from 'vitest'
import * as repo from '../src/repo.js'

vi.mock('../src/repo.js', () => ({
  otherThing: vi.fn(() => 'mockedB'),
}))

test('factory mock applies after automock', () => {
  expect(repo.otherThing()).toBe('mockedB')
})
    `,
  })

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "test/testA.test.ts": {
        "automock works first": "passed",
      },
      "test/testB.test.ts": {
        "factory mock applies after automock": "passed",
      },
    }
  `)
})
