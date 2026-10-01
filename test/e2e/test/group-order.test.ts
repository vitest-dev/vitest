import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('tests run according to the group order', async () => {
  const { stdout, stderr } = await runInlineTests(
    {
      'example.1.test.ts': `test('1', () => {})`,
      'example.2.test.ts': `test('2', () => {})`,
      'example.2-2.test.ts': `test('2-2', () => {})`,
      'example.3.test.ts': `test('3', () => {})`,
    },
    {
      $cliOptions: { globals: true },
      // run projects in the opposite order!
      projects: [
        {
          test: {
            name: '3',
            include: ['./example.3.test.ts'],
            sequence: {
              groupOrder: 1,
            },
          },
        },
        {
          test: {
            include: ['./example.2.test.ts', './example.2-2.test.ts'],
            name: '2',
            sequence: {
              groupOrder: 2,
            },
          },
        },
        {
          test: {
            name: '1',
            include: ['./example.1.test.ts'],
            sequence: {
              groupOrder: 3,
            },
          },
        },
      ],
    },
  )
  expect(stderr).toBe('')

  const tests = stdout
    .split('\n')
    .filter((c) => c.startsWith(' ✓'))
    .join('\n')
    .replace(/\d+ms/g, '<time>')

  expect(tests).toMatchInlineSnapshot(`
    " ✓ |3| example.3.test.ts > 3 <time>
     ✓ |2| example.2-2.test.ts > 2-2 <time>
     ✓ |2| example.2.test.ts > 2 <time>
     ✓ |1| example.1.test.ts > 1 <time>"
  `)
})

test('the next group does not reuse a pool id that is still in use', async () => {
  const uniquePoolId = /* ts */ `
    import { mkdirSync, rmSync } from 'node:fs'
    import { onTestFinished, test } from 'vitest'

    test('unique pool id', async () => {
      const locks = import.meta.dirname + '/../.locks'
      mkdirSync(locks, { recursive: true })
      const lock = locks + '/' + process.env.VITEST_POOL_ID
      mkdirSync(lock)
      onTestFinished(() => rmSync(lock, { recursive: true }))
      await new Promise(resolve => setTimeout(resolve, 200))
    })
  `
  const { stderr, testTree } = await runInlineTests(
    {
      // starts first with pool id 1 and finishes last in its group
      'first/slow.test.ts': `test('slow', () => new Promise(resolve => setTimeout(resolve, 500)))`,
      'first/fast-1.test.ts': `test('fast', () => {})`,
      'first/fast-2.test.ts': `test('fast', () => {})`,
      'first/fast-3.test.ts': `test('fast', () => {})`,
      'second/1.test.ts': uniquePoolId,
      'second/2.test.ts': uniquePoolId,
      'second/3.test.ts': uniquePoolId,
      'second/4.test.ts': uniquePoolId,
    },
    {
      $cliOptions: { globals: true, maxWorkers: 4 },
      projects: [
        {
          test: {
            name: 'first',
            include: ['./first/*.test.ts'],
          },
        },
        {
          test: {
            name: 'second',
            include: ['./second/*.test.ts'],
            sequence: {
              groupOrder: 1,
            },
          },
        },
      ],
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "first/fast-1.test.ts": {
        "fast": "passed",
      },
      "first/fast-2.test.ts": {
        "fast": "passed",
      },
      "first/fast-3.test.ts": {
        "fast": "passed",
      },
      "first/slow.test.ts": {
        "slow": "passed",
      },
      "second/1.test.ts": {
        "unique pool id": "passed",
      },
      "second/2.test.ts": {
        "unique pool id": "passed",
      },
      "second/3.test.ts": {
        "unique pool id": "passed",
      },
      "second/4.test.ts": {
        "unique pool id": "passed",
      },
    }
  `)
})
