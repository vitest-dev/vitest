import { automockModule } from '@vitest/browser/src/node/automocker.js'
import { parseAst } from 'vite'
import { test } from 'vitest'

test('correctly parses', () => {
  console.error(automockModule(
    `
export const test = '22'
export function fn() {}
export const {...rest} = {}
export default () => {}
export default class Test {}
export default 12345
    `,
    parseAst,
  ).toString())
})
