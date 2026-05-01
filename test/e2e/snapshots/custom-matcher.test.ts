import fs, { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { playwright } from '@vitest/browser-playwright'
import { expect, test } from 'vitest'
import { editFile, runInlineTests, runVitest } from '../../test-utils'
import { extractInlineSnaphsots } from './utils'

test('custom snapshot matcher', async () => {
  const root = join(import.meta.dirname, 'fixtures/custom-matcher')
  const testFile = join(root, 'basic.test.ts')
  const snapshotFile = join(root, '__snapshots__/basic.test.ts.snap')
  const rawSnapshotFile = join(root, '__snapshots__/raw.txt')

  // remove snapshots
  fs.rmSync(join(root, '__snapshots__'), { recursive: true, force: true })
  editFile(testFile, s => s.replace(/toMatchCustomInlineSnapshot\(`[^`]*`\)/g, 'toMatchCustomInlineSnapshot()'))

  // create snapshots from scratch
  let result = await runVitest({ root, update: 'new' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > async inline
    Error: [custom error] Snapshot \`async inline 1\` mismatched

    - Expected
    + Received

    - Object {
    + {
        "length": 6,
        "reversed": "uhuhuh",
      }

     ❯ basic.test.ts:86:3
         84|       "length": 6,
         85|       "reversed": "eheheh",
         86|     }
           |   ^
         87|   \`)
         88| })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

    "
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file 1\`] = \`
    {
      "length": 6,
      "reversed": "ahahah",
    }
    \`;

    exports[\`properties 1 1\`] = \`
    {
      "length": 6,
      "reversed": "opopop",
    }
    \`;

    exports[\`properties 2 1\`] = \`
    {
      "length": toSatisfy<[Function lessThan10]>,
      "reversed": "epepep",
    }
    \`;
    "
  `)
  expect(readFileSync(rawSnapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "{
      "length": 6,
      "reversed": "ihihih",
    }"
  `)
  expect(extractInlineSnaphsots(readFileSync(testFile, 'utf-8'))).toMatchInlineSnapshot(`
    "
    expect(\`hehehe\`).toMatchCustomInlineSnapshot(\`
        {
          "length": 6,
          "reversed": "eheheh",
        }
      \`)

    expect(\`huhuhu\`).toMatchCustomAsyncInlineSnapshot(\`
        Object {
          "length": 6,
          "reversed": "uhuhuh",
        }
      \`)
    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async inline": [
          "[custom error] Snapshot \`async inline 1\` mismatched",
        ],
        "file": "passed",
        "inline": "passed",
        "properties 1": "passed",
        "properties 2": "passed",
        "raw": "passed",
      },
    }
  `)

  // edit tests to introduce snapshot errors
  editFile(testFile, s => s
    .replace('`hahaha`', '`hahaha-edit`')
    .replace('`popopo`', '`popopo-edit`')
    .replace('`pepepe`', '`pepepe-edit`')
    .replace('`hihihi`', '`hihihi-edit`')
    .replace('`huhuhu`', '`huhuhu-edit`')
    .replace('`hehehe`', '`hehehe-edit`'))

  result = await runVitest({ root, update: 'none' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > file
    Error: [custom error] Snapshot \`file 1\` mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    -   "reversed": "ahahah",
    +   "reversed": "tide-ahahah",
      }

     ❯ basic.test.ts:66:25
         64|
         65| test('file', () => {
         66|   expect(\`hahaha-edit\`).toMatchCustomSnapshot()
           |                         ^
         67| })
         68|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

     FAIL  basic.test.ts > properties 1
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    +   "reversed": "tide-opopop",
      }

     ❯ basic.test.ts:70:25
         68|
         69| test('properties 1', () => {
         70|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         71| })
         72|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

     FAIL  basic.test.ts > properties 2
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": toSatisfy<[Function lessThan10]>,
    +   "length": 11,
    +   "reversed": "tide-epepep",
      }

     ❯ basic.test.ts:74:25
         72|
         73| test('properties 2', () => {
         74|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         75| })
         76|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

     FAIL  basic.test.ts > raw
    Error: [custom error] Snapshot \`raw 1\` mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    -   "reversed": "ihihih",
    +   "reversed": "tide-ihihih",
      }

     ❯ basic.test.ts:78:3
         76|
         77| test('raw', async () => {
         78|   await expect(\`hihihi-edit\`).toMatchCustomFileSnapshot('./__snapshots…
           |   ^
         79| })
         80|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

     FAIL  basic.test.ts > inline
    Error: [custom error] Snapshot \`inline 1\` mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    -   "reversed": "eheheh",
    +   "reversed": "tide-eheheh",
      }

     ❯ basic.test.ts:82:25
         80|
         81| test('inline', () => {
         82|   expect(\`hehehe-edit\`).toMatchCustomInlineSnapshot(\`
           |                         ^
         83|     {
         84|       "length": 6,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

     FAIL  basic.test.ts > async inline
    Error: [custom error] Snapshot \`async inline 1\` mismatched

    - Expected
    + Received

    - Object {
    + {
    -   "length": 6,
    +   "length": 11,
    -   "reversed": "uhuhuh",
    +   "reversed": "tide-uhuhuh",
      }

     ❯ basic.test.ts:91:3
         89|
         90| test('async inline', async () => {
         91|   await expect(\`huhuhu-edit\`).toMatchCustomAsyncInlineSnapshot(\`
           |   ^
         92|     Object {
         93|       "length": 6,

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async inline": [
          "[custom error] Snapshot \`async inline 1\` mismatched",
        ],
        "file": [
          "[custom error] Snapshot \`file 1\` mismatched",
        ],
        "inline": [
          "[custom error] Snapshot \`inline 1\` mismatched",
        ],
        "properties 1": [
          "[custom error] Snapshot properties mismatched",
        ],
        "properties 2": [
          "[custom error] Snapshot properties mismatched",
        ],
        "raw": [
          "[custom error] Snapshot \`raw 1\` mismatched",
        ],
      },
    }
  `)

  // run with update
  result = await runVitest({ root, update: 'all' })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > properties 1
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": 6,
    +   "length": 11,
    +   "reversed": "tide-opopop",
      }

     ❯ basic.test.ts:70:25
         68|
         69| test('properties 1', () => {
         70|   expect(\`popopo-edit\`).toMatchCustomSnapshot({ length: 6 })
           |                         ^
         71| })
         72|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

     FAIL  basic.test.ts > properties 2
    Error: [custom error] Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "length": toSatisfy<[Function lessThan10]>,
    +   "length": 11,
    +   "reversed": "tide-epepep",
      }

     ❯ basic.test.ts:74:25
         72|
         73| test('properties 2', () => {
         74|   expect(\`pepepe-edit\`).toMatchCustomSnapshot({ length: expect.toSatis…
           |                         ^
         75| })
         76|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

    "
  `)
  expect(readFileSync(snapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file 1\`] = \`
    {
      "length": 11,
      "reversed": "tide-ahahah",
    }
    \`;

    exports[\`properties 1 1\`] = \`
    {
      "length": 6,
      "reversed": "opopop",
    }
    \`;

    exports[\`properties 2 1\`] = \`
    {
      "length": toSatisfy<[Function lessThan10]>,
      "reversed": "epepep",
    }
    \`;
    "
  `)
  expect(readFileSync(rawSnapshotFile, 'utf-8')).toMatchInlineSnapshot(`
    "{
      "length": 11,
      "reversed": "tide-ihihih",
    }"
  `)
  expect(extractInlineSnaphsots(readFileSync(testFile, 'utf-8'))).toMatchInlineSnapshot(`
    "
    expect(\`hehehe-edit\`).toMatchCustomInlineSnapshot(\`
        {
          "length": 11,
          "reversed": "tide-eheheh",
        }
      \`)

    expect(\`huhuhu-edit\`).toMatchCustomAsyncInlineSnapshot(\`
        {
          "length": 11,
          "reversed": "tide-uhuhuh",
        }
      \`)
    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "async inline": "passed",
        "file": "passed",
        "inline": "passed",
        "properties 1": [
          "[custom error] Snapshot properties mismatched",
        ],
        "properties 2": [
          "[custom error] Snapshot properties mismatched",
        ],
        "raw": "passed",
      },
    }
  `)
})

test('browser', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { test, expect, Snapshots } from 'vitest'

const {
  toMatchFileSnapshot,
  toMatchInlineSnapshot,
  toMatchSnapshot,
} = Snapshots

expect.extend({
  toMatchTrimmedSnapshot(received: string) {
    return toMatchSnapshot.call(this, received.slice(0, 10))
  },
  toMatchTrimmedInlineSnapshot(received: string, inlineSnapshot?: string) {
    return toMatchInlineSnapshot.call(this, received.slice(0, 10), inlineSnapshot)
  },
  async toMatchTrimmedFileSnapshot(received: string, filepath: string) {
    return toMatchFileSnapshot.call(this, received.slice(0, 10), filepath)
  },
})

test('file snapshot', () => {
  expect('extra long string oh my gerd').toMatchTrimmedSnapshot()
})

test('inline snapshot', () => {
  expect('super long string oh my gerd').toMatchTrimmedInlineSnapshot()
})

test('raw file snapshot', async () => {
  await expect('crazy long string oh my gerd').toMatchTrimmedFileSnapshot('./raw.txt')
})
`,
  }, {
    update: 'all',
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
        },
      ],
    },
  })
  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "file snapshot": "passed",
        "inline snapshot": "passed",
        "raw file snapshot": "passed",
      },
    }
  `)
  expect(result.fs.readFile('__snapshots__/basic.test.ts.snap')).toMatchInlineSnapshot(`
    "// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

    exports[\`file snapshot 1\`] = \`"extra long"\`;
    "
  `)
  expect(extractInlineSnaphsots(result.fs.readFile('basic.test.ts'))).toMatchInlineSnapshot(`
    "
    expect('super long string oh my gerd').toMatchTrimmedInlineSnapshot(\`"super long"\`)
    "
  `)
  expect(result.fs.readFile('raw.txt')).toMatchInlineSnapshot(`"crazy long"`)
})

test('outer expect message is prefixed by jest-extend for Snapshots wrappers', async () => {
  const result = await runInlineTests({
    'basic.test.ts': `
import { test, expect, Snapshots } from 'vitest'

const {
  toMatchInlineSnapshot,
} = Snapshots

expect.extend({
  toMatchTrimmedInlineSnapshot(received: string, inlineSnapshot?: string) {
    return toMatchInlineSnapshot.call(this, received.slice(0, 5), inlineSnapshot)
  },
})

test('custom snapshot matcher', () => {
  expect('abcdefghij', 'outer message').toMatchTrimmedInlineSnapshot(\`"wrong"\`)
})

test('builtin', () => {
  expect('abcdefghij', 'outer message').toMatchInlineSnapshot(\`"wrong"\`)
})

test('builtin properties mismatch', () => {
  expect({ value: 1 }, 'outer message').toMatchSnapshot({
    value: expect.any(String),
  })
})
`,
  }, {
    update: 'none',
  })
  expect(result.stderr).toMatchInlineSnapshot(`
    "
    ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

     FAIL  basic.test.ts > custom snapshot matcher
    Error: outer message: Snapshot \`custom snapshot matcher 1\` mismatched

    Expected: ""wrong""
    Received: ""abcde""

     ❯ basic.test.ts:15:41
         13|
         14| test('custom snapshot matcher', () => {
         15|   expect('abcdefghij', 'outer message').toMatchTrimmedInlineSnapshot(\`…
           |                                         ^
         16| })
         17|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

     FAIL  basic.test.ts > builtin
    Error: outer message: Snapshot \`builtin 1\` mismatched

    Expected: ""wrong""
    Received: ""abcdefghij""

     ❯ basic.test.ts:19:41
         17|
         18| test('builtin', () => {
         19|   expect('abcdefghij', 'outer message').toMatchInlineSnapshot(\`"wrong"…
           |                                         ^
         20| })
         21|

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

     FAIL  basic.test.ts > builtin properties mismatch
    Error: outer message: Snapshot properties mismatched

    - Expected
    + Received

      {
    -   "value": Any<String>,
    +   "value": 1,
      }

     ❯ basic.test.ts:23:41
         21|
         22| test('builtin properties mismatch', () => {
         23|   expect({ value: 1 }, 'outer message').toMatchSnapshot({
           |                                         ^
         24|     value: expect.any(String),
         25|   })

    ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯

    "
  `)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "builtin": [
          "outer message: Snapshot \`builtin 1\` mismatched",
        ],
        "builtin properties mismatch": [
          "outer message: Snapshot properties mismatched",
        ],
        "custom snapshot matcher": [
          "outer message: Snapshot \`custom snapshot matcher 1\` mismatched",
        ],
      },
    }
  `)
})
