import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('prints a custom error stack', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': `
    test('failed test', () => {
      throw {
        message: 'from failed test',
        stack: ['stack 1', 'stack 2'],
      }
    })

    test('fails toJson', () => {
      class CustomError extends Error {
        name = 'CustomError'
        toJSON() {
          return {
            message: this.message,
            stack: ['custom stack 1', 'custom stack 2']
          }
        }
      }

      throw new CustomError('custom error')
    })
    `,
  }, { globals: true })

  expect(stderr).toContain(`
 FAIL  basic.test.ts > failed test
Unknown Error: from failed test
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { stack: [ 'stack 1', 'stack 2' ] }
    `.trim())

  expect(stderr).toContain(`
 FAIL  basic.test.ts > fails toJson
CustomError: custom error
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { stack: [ 'custom stack 1', 'custom stack 2' ] }
    `.trim())
})

test('prints buffer and UintArray', async () => {
  const { stderr } = await runInlineTests({
    'basic.test.ts': `
    test('failed test', () => {
      throw {
        buffer: Buffer.from([1, 2, 3]),
        uintarray: Uint8Array.from([1, 2, 3]),
      }
    })
    `,
  }, { globals: true })

  expect(stderr).toContain(`buffer: '<Buffer(3) ...>'`)
  expect(stderr).toContain(`uintarray: '<Uint8Array(3) ...>'`)
})
