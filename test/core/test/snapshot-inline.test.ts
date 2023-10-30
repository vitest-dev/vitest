import { expect, test } from 'vitest'

test('object', () => {
  expect({
    foo: {
      type: 'object',
      map: new Map(),
    },
  })
    .toMatchInlineSnapshot(`
      {
        "foo": {
          "map": Map {},
          "type": "object",
        },
      }
    `)
})

test('single line', () => {
  expect('inline string').toMatchInlineSnapshot('"inline string"')
  expect('inline $ string').toMatchInlineSnapshot('"inline $ string"')
  expect('inline multiline\n $string').toMatchInlineSnapshot(`
    "inline multiline
     $string"
  `)
  // eslint-disable-next-line no-template-curly-in-string
  expect('inline multiline\n ${string}').toMatchInlineSnapshot(`
    "inline multiline
     \${string}"
  `)
})

test('multiline', () => {
  const indent = `
()=>
  array
    .map(fn)
    .filter(fn)
`
  expect(indent).toMatchInlineSnapshot(`
    "
    ()=>
      array
        .map(fn)
        .filter(fn)
    "
  `)
})

test('template literal', () => {
  const literal = `
  Hello \${world}
`
  expect(literal).toMatchInlineSnapshot(`
    "
      Hello \${world}
    "
  `)
})

test('custom serializer against thrown instance', async () => {
  class ErrorWithDetails extends Error {
    readonly details: unknown

    constructor(message: string, options: ErrorOptions & { details: unknown }) {
      super(message, options)
      this.details = options.details
    }
  }

  // without custom serializer
  const error = new ErrorWithDetails('Example', { details: 'interesting detail' })
  expect(error).toMatchInlineSnapshot(`[Error: Example]`)
  expect(() => {
    throw error
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Example]`)

  // with custom serializer
  expect.addSnapshotSerializer({
    serialize(val, config, indentation, depth, refs, printer) {
      const error = val as ErrorWithDetails
      return `${error.message}: ${printer(error.details, config, indentation, depth, refs)}`
    },
    test(val) {
      return val && val instanceof ErrorWithDetails
    },
  })
  expect(() => {
    throw error
  }).toThrowErrorMatchingInlineSnapshot(`Example: "interesting detail"`) // serializer applied
  expect(error).toMatchInlineSnapshot(`Example: "interesting detail"`) // serializer applied

  //
  // workaround 1 (for async error)
  //   by unwrapping with `rejects, it can assert error instance via `toMatchInlineSnapshot`
  //
  await expect(async () => {
    throw error
  }).rejects.toMatchInlineSnapshot(`Example: "interesting detail"`)

  //
  // workaround 2
  //   create a utility to catch error and use it to assert snapshot via `toMatchInlineSnapshot`
  //
  function wrapError<T>(f: () => T): { success: true; data: T } | { success: false; error: unknown } {
    try {
      return { success: true, data: f() }
    }
    catch (error) {
      return { success: false, error }
    }
  }
  expect(wrapError(() => {
    throw error
  })).toMatchInlineSnapshot(`
    {
      "error": Example: "interesting detail",
      "success": false,
    }
  `)
})

test('throwing inline snapshots', async () => {
  expect(() => {
    throw new Error('omega')
  }).toThrowErrorMatchingInlineSnapshot(`[Error: omega]`)

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'omega'
  }).toThrowErrorMatchingInlineSnapshot('"omega"')

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw { error: 'omega' }
  }).toThrowErrorMatchingInlineSnapshot(`
    {
      "error": "omega",
    }
  `)

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw { some: { nested: { error: 'object' } } }
  }).toThrowErrorMatchingInlineSnapshot(`
    {
      "some": {
        "nested": {
          "error": "object",
        },
      },
    }
  `)

  expect(() => {
    throw ['Inline', 'snapshot', 'with', 'newlines'].join('\n')
  }).toThrowErrorMatchingInlineSnapshot(`
    "Inline
    snapshot
    with
    newlines"
  `)

  await expect(async () => {
    throw new Error('omega')
  }).rejects.toThrowErrorMatchingInlineSnapshot('"omega"')
})

test('throwing expect should be a function', async () => {
  expect(() => {
    expect(new Error('omega')).toThrowErrorMatchingInlineSnapshot()
  }).toThrow(/expected must be a function/)
})

test('properties inline snapshot', () => {
  const user = {
    createdAt: new Date(),
    id: Math.floor(Math.random() * 20),
    name: 'LeBron James',
  }

  expect(user).toMatchInlineSnapshot({
    createdAt: expect.any(Date),
    id: expect.any(Number),
  }, `
    {
      "createdAt": Any<Date>,
      "id": Any<Number>,
      "name": "LeBron James",
    }
  `)
})

test('literal tag', () => {
  const html = String.raw
  const text = `
<body>
  <h1>My First Heading.</h1>
  <p>My first paragraph.</p>
</body>
`

  expect(text).toMatchInlineSnapshot(html`
    "
    <body>
      <h1>My First Heading.</h1>
      <p>My first paragraph.</p>
    </body>
    "
  `)
})

test('resolves', async () => {
  const getText = async () => 'text'
  await expect(getText()).resolves.toMatchInlineSnapshot('"text"')
})

test('rejects', async () => {
  const getText = async () => {
    throw new Error('error')
  }
  await expect(getText()).rejects.toMatchInlineSnapshot('[Error: error]')
})
