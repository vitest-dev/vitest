import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('tests run according to the group order', async () => {
  const { stdout, stderr } = await runInlineTests({
    'example.1.test.ts': `test('1', () => {})`,
    'example.2.test.ts': `test('2', () => {})`,
    'example.2-2.test.ts': `test('2-2', () => {})`,
    'example.3.test.ts': `test('3', () => {})`,
  }, {
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
  })
  expect(stderr).toBe('')

  const tests = stdout.split('\n').filter(c => c.startsWith(' ✓')).join('\n').replace(/\d+ms/g, '<time>')

  expect(tests).toMatchInlineSnapshot(`
    " ✓ |3| example.3.test.ts > 3 <time>
     ✓ |2| example.2-2.test.ts > 2-2 <time>
     ✓ |2| example.2.test.ts > 2 <time>
     ✓ |1| example.1.test.ts > 1 <time>"
  `)
})
