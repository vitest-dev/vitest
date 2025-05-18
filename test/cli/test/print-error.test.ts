import { expect, test } from 'vitest';
import { runInlineTests } from '../../test-utils';

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
        toJSON() {
          return {
            message: this.message,
            stack: ['custom stack 1', 'custom stack 2']
          }
        }
      }

      throw new CustomError('custom error')
    })
    `
  }, { globals: true })

  expect(stderr).toContain(`
 FAIL  basic.test.ts > failed test
Unknown Error: from failed test
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { stack: [ 'stack 1', 'stack 2' ] }
    `.trim())

  expect(stderr).toContain(`
 FAIL  basic.test.ts > fails toJson
Unknown Error: custom error
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { stack: [ 'custom stack 1', 'custom stack 2' ] }
    `.trim())
})