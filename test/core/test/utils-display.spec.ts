import util from 'node:util'
import { format } from '@vitest/utils'
import { describe, expect, test } from 'vitest'

describe('format', () => {
  const obj = {} as any
  obj.obj = obj

  test.each([
    [''],
    ['test'],
    [{ obj: { nested: true }, value: 1 }],
    ['test %s', 'test'],
    ['test %s %s', 'test', 'test'],
    ['test %s %s', 'test', 'test', 'test'],
    ['%s', 100],
    ['%s', 100n],
    ['%s', -0],
    ['%s', null],
    ['%s', null, 'next'],
    ['%d', 100],
    ['%d', 100n],
    ['%d', null],
    ['%d', {}],
    ['%d', {}, 'next'],
    ['%i', 100],
    ['%i', 100n],
    ['%i', null],
    ['%i', {}],
    ['%i', {}, 'next'],
    ['%f', 100],
    ['%f', 100n],
    ['%f', null],
    ['%f', {}],
    ['%f', {}, 'next'],
    ['%o', 'string'],
    ['%o', 100],
    ['%o', 100n],
    ['%o', null],
    ['%o', {}],
    ['%o', {}, 'next'],
    ['%O', 'string'],
    ['%O', 100],
    ['%O', 100n],
    ['%O', null],
    ['%O', {}],
    ['%O', {}, 'next'],
    ['%c', 'css value'],
    ['%c', 'css value', 'some other value'],
    ['%c %f', 'css value', '100.00'],
    ['%j', 'string'],
    ['%j', 100],
    ['%j', null],
    ['%j', {}],
    ['%j', {}, 'next'],
    ['%j', { obj }],
    ['%j', { fn: () => {} }],
    ['%%', 'string'],
  ])('format(%s)', (formatString, ...args) => {
    expect(format(formatString, ...args), `failed ${formatString}`).toBe(util.format(formatString, ...args))
  })

  test('cannot serialize some values', () => {
    expect(() => format('%j', 100n)).toThrowErrorMatchingInlineSnapshot(`[TypeError: Do not know how to serialize a BigInt]`)
  })

  test.each(
    [
      {
        name: 'without format',
        args: [{ n: { a: { b: { c: { d: { e: '3' } } } } } }],
        result: '{ n: { a: { b: { c: { d: { e: \'3\' } } } } } }',
      },
      {
        name: 'as an object',
        args: ['%o', {}, { n: { a: { b: { c: '3' } } } }],
        result: '{} { n: { a: { b: { c: \'3\' } } } }',
      },
      {
        name: 'as a full object',
        args: ['%O', {}, { n: { a: { b: { c: '3' } } } }],
        result: '{} { n: { a: { b: { c: \'3\' } } } }',
      },
      {
        name: 'as a json',
        args: ['%j', {}, { n: { a: { b: { c: '3' } } } }],
        result: '{} { n: { a: { b: { c: \'3\' } } } }',
      },
    ],
  )('formats objects $name (loupe doesn\'t respect depth)', ({ args, result }) => {
    expect(format(...args)).toBe(result)
  })
})
