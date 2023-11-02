import { expect, test } from 'vitest'

test('basic', () => {
  // example from docs/guide/snapshot.md

  const bar = {
    foo: {
      x: 1,
      y: 2,
    },
  }

  // without custom serializer
  expect(bar).toMatchInlineSnapshot(`
    {
      "foo": {
        "x": 1,
        "y": 2,
      },
    }
  `)

  // with custom serializer
  expect.addSnapshotSerializer({
    serialize(val, config, indentation, depth, refs, printer) {
      return `Pretty foo: ${printer(
        val.foo,
        config,
        indentation,
        depth,
        refs,
      )}`
    },
    test(val) {
      return val && Object.prototype.hasOwnProperty.call(val, 'foo')
    },
  })

  expect(bar).toMatchInlineSnapshot(`
    Pretty foo: {
      "x": 1,
      "y": 2,
    }
  `)
})

test('throwning snapshot', () => {
  // example from https://github.com/vitest-dev/vitest/issues/3655

  class ErrorWithDetails extends Error {
    readonly details: unknown

    constructor(message: string, options: ErrorOptions & { details: unknown }) {
      super(message, options)
      this.details = options.details
    }
  }

  // without custom serializer
  const error = new ErrorWithDetails('some-error', {
    details: 'some-detail',
  })
  expect(error).toMatchInlineSnapshot(`[Error: some-error]`)
  expect(() => {
    throw error
  }).toThrowErrorMatchingInlineSnapshot(`[Error: some-error]`)

  // with custom serializer
  expect.addSnapshotSerializer({
    serialize(val, config, indentation, depth, refs, printer) {
      const error = val as ErrorWithDetails
      return `Pretty ${error.message}: ${printer(
        error.details,
        config,
        indentation,
        depth,
        refs,
      )}`
    },
    test(val) {
      return val && val instanceof ErrorWithDetails
    },
  })
  expect(error).toMatchInlineSnapshot(`Pretty some-error: "some-detail"`)
  expect(() => {
    throw error
  }).toThrowErrorMatchingInlineSnapshot(`Pretty some-error: "some-detail"`)
})
