/* eslint-disable no-lone-blocks */

import { expect, test } from 'vitest'

test('expect.* allows asymmetrict mattchers with different types', async () => {
  // types.ts examples: stringContaining
  expect('I have an apple').toEqual(expect.stringContaining('apple'))
  expect('I have an apple').toEqual<string>(expect.stringContaining('apple'))
  await (expect(Promise.resolve('I have an apple')).resolves.toEqual<string>(expect.stringContaining('apple')) satisfies Promise<void>)

  expect({ a: 'test string' }).toEqual({ a: expect.stringContaining('test') })
  expect({ a: 'test string' }).toEqual<{ a: string }>({ a: expect.stringContaining('test') })
  await (expect(Promise.resolve({ a: 'test string' })).resolves.toEqual<{ a: string }>({ a: expect.stringContaining('test') }) satisfies Promise<void>)

  // types.ts examples: objectContaining
  expect({ a: '1', b: 2 }).toEqual(expect.objectContaining({ a: '1' }))
  expect({ a: '1', b: 2 }).toEqual<{ a: string; b: string }>(expect.objectContaining({ a: '1' }))
  await (expect(Promise.resolve({ a: '1', b: 2 })).resolves.toEqual<{ a: string; b: string }>(expect.objectContaining({ a: '1' })) satisfies Promise<void>)

  // types.ts examples: arrayContaining
  expect(['a', 'b', 'c']).toEqual(expect.arrayContaining(['b', 'a']))
  expect(['a', 'b', 'c']).toEqual<string[]>(expect.arrayContaining(['b', 'a']))
  await (expect(Promise.resolve(['a', 'b', 'c'])).resolves.toEqual<string[]>(expect.arrayContaining(['b', 'a'])) satisfies Promise<void>)

  // types.ts examples: stringMatching
  expect('hello world').toEqual(expect.stringMatching(/^hello/))
  expect('hello world').toEqual<string>(expect.stringMatching(/^hello/))
  await (expect(Promise.resolve('hello world')).resolves.toEqual<string>(expect.stringMatching(/^hello/)) satisfies Promise<void>)

  expect('hello world').toEqual(expect.stringMatching('hello'))
  expect('hello world').toEqual<string>(expect.stringMatching('hello'))
  await (expect(Promise.resolve('hello world')).resolves.toEqual<string>(expect.stringMatching('hello')) satisfies Promise<void>)

  // types.ts examples: closeTo
  expect(10.45).toEqual(expect.closeTo(10.5, 1))
  expect(10.45).toEqual<number>(expect.closeTo(10.5, 1))
  await (expect(Promise.resolve(10.45)).resolves.toEqual<number>(expect.closeTo(10.5, 1)) satisfies Promise<void>)

  expect(5.11).toEqual(expect.closeTo(5.12))
  expect(5.11).toEqual<number>(expect.closeTo(5.12))
  await (expect(Promise.resolve(5.11)).resolves.toEqual<number>(expect.closeTo(5.12)) satisfies Promise<void>)

  // expect.any(String)
  // https://github.com/vitest-dev/vitest/pull/7016#issuecomment-2517674066
  {
    const obj = {
      id: '',
      name: '',
    }

    expect(obj).toEqual({
      id: expect.any(String),
      name: 'Amelia',
    })

    expect(obj).toEqual<{
      id: string
      name: string
    }>({
      id: expect.any(String),
      name: 'Amelia',
    })

    await (expect(Promise.resolve(obj)).resolves.toEqual<{
      id: string
      name: string
    }>({
      id: expect.any(String),
      name: 'Amelia',
    }) satisfies Promise<void>)
  }

  // expect.any(Date)
  // https://github.com/vitest-dev/vitest/issues/4543#issuecomment-1817960296
  // https://github.com/vitest-dev/vitest/issues/4543#issuecomment-1817967628
  // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/62831#issue-1418959169
  {
    const actual = {} as {
      foo: string
      bar: string
      createdAt: Date
    }

    expect(actual).toEqual({
      foo: 'foo',
      bar: 'bar',
      createdAt: expect.any(Date),
    })

    expect(actual).toEqual<{
      foo: string
      bar: string
      createdAt: Date
    }>({
      foo: 'foo',
      bar: 'bar',
      createdAt: expect.any(Date),
    })

    await (expect(Promise.resolve(actual)).resolves.toEqual<{
      foo: string
      bar: string
      createdAt: Date
    }>({
      foo: 'foo',
      bar: 'bar',
      createdAt: expect.any(Date),
    }) satisfies Promise<void>)

    expect(actual).toEqual<{
      foo: string
      bar: string
      createdAt: Date
    }[]>([
      {
        foo: 'foo',
        bar: 'bar',
        createdAt: expect.any(Date),
      },
    ])

    await (expect(Promise.resolve(actual)).resolves.toEqual<{
      foo: string
      bar: string
      createdAt: Date
    }[]>([
      {
        foo: 'foo',
        bar: 'bar',
        createdAt: expect.any(Date),
      },
    ]) satisfies Promise<void>)
  }

  // expect.arrayContaining
  // https://github.com/jestjs/jest/issues/13812#issue-1555843276
  {
    expect([1, 2, 3]).toEqual(expect.arrayContaining(['a']))
    expect([1, 2, 3]).toEqual<number[]>(expect.arrayContaining(['a']))
    await (expect(Promise.resolve([1, 2, 3])).resolves.toEqual<number[]>(expect.arrayContaining(['a'])) satisfies Promise<void>)

    expect([1, 2, 3]).toEqual(expect.arrayContaining([expect.any(Number)]))
    expect([1, 2, 3]).toEqual<number[]>(expect.arrayContaining([expect.any(Number)]))
    await (expect(Promise.resolve([1, 2, 3])).resolves.toEqual<number[]>(expect.arrayContaining([expect.any(Number)])) satisfies Promise<void>)

    expect([1, 2, 3]).toEqual(expect.arrayContaining([expect.anything()]))
    expect([1, 2, 3]).toEqual<number[]>(expect.arrayContaining([expect.anything()]))
    await (expect(Promise.resolve([1, 2, 3])).resolves.toEqual<number[]>(expect.arrayContaining([expect.anything()])) satisfies Promise<void>)
  }

  // expect.any(Array)
  // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/62831/files#diff-ff7b882e4a29e7fe0e348a6bdf8b11774d606eaa221009b166b01389576d921fR1237
  expect({ list: [1, 2, 3] }).toMatchObject({ list: expect.any(Array) })
  expect({ list: [1, 2, 3] }).toMatchObject<{ list: number[] }>({ list: expect.any(Array) })
  await (expect(Promise.resolve({ list: [1, 2, 3] })).resolves.toMatchObject<{ list: number[] }>({ list: expect.any(Array) }) satisfies Promise<void>)

  // expect<T>
  // https://github.com/vitest-dev/vitest/issues/8081
  function expectMany<T>(value: ({ enabled: false } | { enabled: true; data: T })) {
    expect(value).toEqual(value)
    expect(value).toMatchObject(value)
  }
  expectMany({ enabled: true, data: 'ok' })
})
