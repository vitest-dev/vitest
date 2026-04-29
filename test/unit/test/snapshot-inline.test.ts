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

  expect(() => {
    throw new Error(['Inline', 'snapshot', 'with', 'newlines'].join('\n'))
  }).toThrowErrorMatchingInlineSnapshot(`
    [Error: Inline
    snapshot
    with
    newlines]
  `)

  expect(new Error(['Inline', 'snapshot', 'with', 'newlines'].join('\n'))).toMatchInlineSnapshot(`
    [Error: Inline
    snapshot
    with
    newlines]
  `)

  await expect(async () => {
    throw new Error('omega')
  }).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: omega]`)
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
