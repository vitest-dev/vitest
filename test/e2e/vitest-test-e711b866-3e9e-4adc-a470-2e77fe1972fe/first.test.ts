
test("always good", () => {})

test("works on linux", () => {
  expect(process.env.TEST_LABEL_ENV === 'linux').toBe(true)
})

test("works on macos", () => {
  expect(process.env.TEST_LABEL_ENV === 'macos').toBe(true)
})
