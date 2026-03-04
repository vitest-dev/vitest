import { expect, test } from 'vitest'
import { render } from './utils'

test('.toBeRequired', () => {
  const {queryByTestId} = render(`
    <div>
      <input data-testid="required-input" required>
      <input data-testid="aria-required-input" aria-required="true">
      <input data-testid="conflicted-input" required aria-required="false">
      <input data-testid="not-required-input" aria-required="false">
      <input data-testid="basic-input">
      <input data-testid="unsupported-type" type="image" required>
      <select data-testid="select" required></select>
      <textarea data-testid="textarea" required></textarea>
      <div data-testid="supported-role" role="tree" required></div>
      <div data-testid="supported-role-aria" role="tree" aria-required="true"></div>
    </div>
    `)

  expect(queryByTestId('required-input')).toBeRequired()
  expect(queryByTestId('aria-required-input')).toBeRequired()
  expect(queryByTestId('conflicted-input')).toBeRequired()
  expect(queryByTestId('not-required-input')).not.toBeRequired()
  expect(queryByTestId('basic-input')).not.toBeRequired()
  expect(queryByTestId('unsupported-type')).not.toBeRequired()
  expect(queryByTestId('select')).toBeRequired()
  expect(queryByTestId('textarea')).toBeRequired()
  expect(queryByTestId('supported-role')).not.toBeRequired()
  expect(queryByTestId('supported-role-aria')).toBeRequired()

  // negative test cases wrapped in throwError assertions for coverage.
  expect(() =>
    expect(queryByTestId('required-input')).not.toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('aria-required-input')).not.toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('conflicted-input')).not.toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('not-required-input')).toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('basic-input')).toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('unsupported-type')).toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('select')).not.toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('textarea')).not.toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('supported-role')).toBeRequired(),
  ).toThrow()
  expect(() =>
    expect(queryByTestId('supported-role-aria')).not.toBeRequired(),
  ).toThrow()
})