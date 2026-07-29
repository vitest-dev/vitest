import { describe, expect, test } from 'vitest'
import { render } from './utils'

// FIXME
// playwright prioritizes native checked to aria-checked for "checkbox" elements
// jest-dom checks aria-checked="mixed" anyway
describe('.toBePartiallyChecked', () => {
  test('handles input checkbox with aria-checked', () => {
    const {queryByTestId} = render(`
      <input type="checkbox" aria-checked="mixed" data-testid="checkbox-mixed" />
      <input type="checkbox" checked data-testid="checkbox-checked" />
      <input type="checkbox" data-testid="checkbox-unchecked" />
    `)

    expect(queryByTestId('checkbox-mixed')).toBePartiallyChecked()
    expect(queryByTestId('checkbox-checked')).not.toBePartiallyChecked()
    expect(queryByTestId('checkbox-unchecked')).not.toBePartiallyChecked()
  })

  test('handles input checkbox set as indeterminate', () => {
    const {queryByTestId} = render(`
      <input type="checkbox" data-testid="checkbox-mixed" />
      <input type="checkbox" checked data-testid="checkbox-checked" />
      <input type="checkbox" data-testid="checkbox-unchecked" />
    `)

    ;(queryByTestId('checkbox-mixed') as HTMLInputElement).indeterminate = true

    expect(queryByTestId('checkbox-mixed')).toBePartiallyChecked()
    expect(queryByTestId('checkbox-checked')).not.toBePartiallyChecked()
    expect(queryByTestId('checkbox-unchecked')).not.toBePartiallyChecked()
  })

  test('handles element with role="checkbox"', () => {
    const {queryByTestId} = render(`
      <div role="checkbox" aria-checked="mixed" data-testid="aria-checkbox-mixed" />
      <div role="checkbox" aria-checked="true" data-testid="aria-checkbox-checked" />
      <div role="checkbox" aria-checked="false" data-testid="aria-checkbox-unchecked" />
    `)

    expect(queryByTestId('aria-checkbox-mixed')).toBePartiallyChecked()
    expect(queryByTestId('aria-checkbox-checked')).not.toBePartiallyChecked()
    expect(queryByTestId('aria-checkbox-unchecked')).not.toBePartiallyChecked()
  })

  test('throws when input checkbox is mixed but expected not to be', () => {
    const {queryByTestId} = render(
      `<input type="checkbox" aria-checked="mixed" data-testid="checkbox-mixed" />`,
    )

    expect(() =>
      expect(queryByTestId('checkbox-mixed')).not.toBePartiallyChecked(),
    ).toThrow()
  })

  test('throws when input checkbox is indeterminate but expected not to be', () => {
    const {queryByTestId} = render(
      `<input type="checkbox" data-testid="checkbox-mixed" />`,
    )

    ;(queryByTestId('checkbox-mixed') as HTMLInputElement).indeterminate = true

    expect(() =>
      expect(queryByTestId('input-mixed')).not.toBePartiallyChecked(),
    ).toThrow()
  })

  test('throws when input checkbox is not checked but expected to be', () => {
    const {queryByTestId} = render(
      `<input type="checkbox" data-testid="checkbox-empty" />`,
    )

    expect(() =>
      expect(queryByTestId('checkbox-empty')).toBePartiallyChecked(),
    ).toThrow()
  })

  test('throws when element with role="checkbox" is partially checked but expected not to be', () => {
    const {queryByTestId} = render(
      `<div role="checkbox" aria-checked="mixed" data-testid="aria-checkbox-mixed" />`,
    )

    expect(() =>
      expect(queryByTestId('aria-checkbox-mixed')).not.toBePartiallyChecked(),
    ).toThrow()
  })

  test('throws when element with role="checkbox" is checked but expected to be partially checked', () => {
    const {queryByTestId} = render(
      `<div role="checkbox" aria-checked="true" data-testid="aria-checkbox-checked" />`,
    )

    expect(() =>
      expect(queryByTestId('aria-checkbox-checked')).toBePartiallyChecked(),
    ).toThrow()
  })

  test('throws when element with role="checkbox" is not checked but expected to be', () => {
    const {queryByTestId} = render(
      `<div role="checkbox" aria-checked="false" data-testid="aria-checkbox" />`,
    )

    expect(() =>
      expect(queryByTestId('aria-checkbox')).toBePartiallyChecked(),
    ).toThrow()
  })

  test('throws when element with role="checkbox" has an invalid aria-checked attribute', () => {
    const {queryByTestId} = render(
      `<div role="checkbox" aria-checked="something" data-testid="aria-checkbox-invalid" />`,
    )

    expect(() =>
      expect(queryByTestId('aria-checkbox-invalid')).toBePartiallyChecked(),
    ).toThrow()
  })

  test('throws when the element is not a checkbox', () => {
    const {queryByTestId} = render(`<select data-testid="select"></select>`)
    expect(() =>
      expect(queryByTestId('select')).toBePartiallyChecked(),
    ).toThrow(
      'only inputs with type="checkbox" or elements with role="checkbox" and a valid aria-checked attribute can be used with .toBePartiallyChecked(). Use .toHaveValue() instead',
    )
  })
})