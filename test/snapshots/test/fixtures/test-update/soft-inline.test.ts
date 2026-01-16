test('expect.soft fails if run with toMatchInlineSnapshot', () => {
  let exceptionThrown = false
  try {
    expect.soft(1).toMatchInlineSnapshot(`1`)
  }
  catch (error: any) {
    expect(error?.message).toContain('toMatchInlineSnapshot cannot be used with "soft"')
    exceptionThrown = true
  }

  expect(exceptionThrown).toBe(true)
})

test('expect.soft fails if run with toThrowErrorMatchingInlineSnapshot', () => {
  let exceptionThrown = false
  try {
    expect.soft(() => {
      throw new Error('1')
    }).toThrowErrorMatchingInlineSnapshot(`[Error: 2]`)
  }
  catch (error: any) {
    expect(error?.message).toContain('toThrowErrorMatchingInlineSnapshot cannot be used with "soft"')
    exceptionThrown = true
  }

  expect(exceptionThrown).toBe(true)
})
