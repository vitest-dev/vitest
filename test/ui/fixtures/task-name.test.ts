import { it, expect} from "vitest"

it('<MyComponent />', () => {
  expect(true).toBe(true)
})

it('<>\'"', () => {
  expect(true).toBe(true)
})

it('char () - Square root of nine (9)', () => {
  expect(Math.sqrt(9)).toBe(3);
});
