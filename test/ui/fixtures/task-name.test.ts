import { it, expect} from "vitest"

it('<MyComponent />', () => {
  expect(true).toBe(true)
})

it('<>\'"', () => {
  expect(true).toBe(true)
})
