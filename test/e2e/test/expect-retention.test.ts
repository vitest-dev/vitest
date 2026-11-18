import { expect, test } from 'vitest'
import { runInlineTests, StableTestFileOrderSorter } from '../../test-utils'

const trackValue = `
  const value = { file: basename(expect.getState().testPath) }
  globalThis.values = [...(globalThis.values ?? []), new WeakRef(value)]
`

function releasedTest(expected: string[]) {
  return `
import v8 from 'node:v8'
import vm from 'node:vm'
import { expect, test } from 'vitest'

v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc')
v8.setFlagsFromString('--no-expose-gc')

test('values of previous files are released', async () => {
  let retained = []
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    gc()
    retained = globalThis.values.map((ref) => ref.deref()?.file).filter(Boolean)
    if (retained.length === ${expected.length}) {
      break
    }
  }
  expect(retained).toEqual(${JSON.stringify(expected)})
})
`
}

test('isolate:false releases fixtures of a file that uses the context expect', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      './a-context-expect.test.ts': `
import { basename } from 'node:path'
import { expect, test as base } from 'vitest'

const test = base.extend({
  app: async ({}, use) => {
    ${trackValue}
    await use(value)
  },
})

test('uses the global expect', ({ app }) => {
  expect(app.file).toBe('a-context-expect.test.ts')
})

test('uses the context expect', ({ app, expect }) => {
  expect(app.file).toBe('a-context-expect.test.ts')
})
`,
      './z-released.test.ts': releasedTest([]),
    },
    {
      isolate: false,
      sequence: { sequencer: StableTestFileOrderSorter },
    },
  )

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "a-context-expect.test.ts": {
        "uses the context expect": "passed",
        "uses the global expect": "passed",
      },
      "z-released.test.ts": {
        "values of previous files are released": "passed",
      },
    }
  `)
})

test('isolate:false releases matchers that setup files of previous files added', async () => {
  const { stderr, errorTree } = await runInlineTests(
    {
      './setup.ts': `
import { basename } from 'node:path'
import { expect } from 'vitest'
${trackValue}
expect.extend({
  toBeTestFile(received) {
    return {
      pass: received === value.file,
      message: () => \`expected \${received} to be \${value.file}\`,
    }
  },
})
`,
      './a.test.ts': `
import { expect, test } from 'vitest'
test('a', () => {
  expect('a.test.ts').toBeTestFile()
})
`,
      './b.test.ts': `
import { expect, test } from 'vitest'
test('b', () => {
  expect('b.test.ts').toBeTestFile()
})
`,
      './z-released.test.ts': releasedTest(['z-released.test.ts']),
    },
    {
      isolate: false,
      setupFiles: ['./setup.ts'],
      sequence: { sequencer: StableTestFileOrderSorter },
    },
  )

  expect(stderr).toBe('')
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "a.test.ts": {
        "a": "passed",
      },
      "b.test.ts": {
        "b": "passed",
      },
      "z-released.test.ts": {
        "values of previous files are released": "passed",
      },
    }
  `)
})
