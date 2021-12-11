import { readFileSync } from 'fs'
import { resolve } from 'path'
import { format } from 'prettier'
import { describe, expect, test } from 'vitest'
import { plugin } from '@prettier/plugin-pug'

describe('plugin-pug', () => {
  test('should handle class attributes', () => {
    const expected: string = readFileSync(
      resolve(__dirname, 'class-attributes-formatted.pug'),
      'utf8',
    )
    const code: string = readFileSync(
      resolve(__dirname, 'class-attributes-unformatted.pug'),
      'utf8',
    )
    const actual: string = format(code, {
      parser: 'pug',
      plugins: [plugin],
      semi: false,
    })

    expect(actual.replace(/\r\n/g, '\n')).toBe(expected.replace(/\r\n/g, '\n'))
  })

  test('should handle slash token', () => {
    const expected: string = readFileSync(
      resolve(__dirname, 'slash-formatted.pug'),
      'utf8',
    )
    const code: string = readFileSync(
      resolve(__dirname, 'slash-unformatted.pug'),
      'utf8',
    )
    const actual: string = format(code, {
      parser: 'pug',
      plugins: [plugin],
    })

    expect(actual.replace(/\r\n/g, '\n')).toBe(expected.replace(/\r\n/g, '\n'))
  })
})
