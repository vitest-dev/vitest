import { expect, test } from 'vitest'
import { render } from './utils'

const window = document.defaultView

window.customElements.define(
  'custom-element',
  class extends window.HTMLElement {},
)

test('.toBeDisabled', () => {
  const {queryByTestId} = render(`
    <div>
      <button disabled={true} data-testid="button-element">x</button>
      <textarea disabled={true} data-testid="textarea-element"></textarea>
      <input type="checkbox" disabled={true} data-testid="input-element" />

      <fieldset disabled={true} data-testid="fieldset-element">
        <button data-testid="fieldset-child-element">x</button>
      </fieldset>

      <div disabled={true} data-testid="div-element">
        <button data-testid="div-child-element">x</button>
      </div>

      <fieldset disabled={true}>
        <div>
          <button data-testid="nested-form-element">x</button>

          <select data-testid="deep-select-element">
            <optgroup data-testid="deep-optgroup-element">
              <option data-testid="deep-option-element">x</option>
            </optgroup>
          </select>
        </div>
        <a href="http://github.com" data-testid="deep-a-element">x</a>
      </fieldset>

      <a href="http://github.com" disabled={true} data-testid="a-element">x</a>
    </div>
    `)

  expect(queryByTestId('button-element')).toBeDisabled()
  expect(() =>
    expect(queryByTestId('button-element')).not.toBeDisabled(),
  ).toThrowError()
  expect(queryByTestId('textarea-element')).toBeDisabled()
  expect(queryByTestId('input-element')).toBeDisabled()

  // technically, everything inside a disabled fieldset is disabled,
  // but the fieldset itself is not considered disabled, because its
  // native tag is not part of
  // https://www.w3.org/TR/html-aam-1.0/#html-attribute-state-and-property-mappings
  // NOTE: this is different from jest-dom, but closer to how PW works
  expect(queryByTestId('fieldset-element')).not.toBeDisabled()
  expect(queryByTestId('fieldset-child-element')).toBeDisabled()

  expect(queryByTestId('div-element')).not.toBeDisabled()
  expect(queryByTestId('div-child-element')).not.toBeDisabled()

  expect(queryByTestId('nested-form-element')).toBeDisabled()
  expect(queryByTestId('deep-select-element')).toBeDisabled()
  expect(queryByTestId('deep-optgroup-element')).toBeDisabled()
  expect(queryByTestId('deep-option-element')).toBeDisabled()

  expect(queryByTestId('a-element')).not.toBeDisabled()
  expect(queryByTestId('deep-a-element')).not.toBeDisabled()
  expect(() => expect(queryByTestId('a-element')).toBeDisabled()).toThrowError()
  expect(() =>
    expect(queryByTestId('deep-a-element')).toBeDisabled(),
  ).toThrowError()
})

test('.toBeDisabled fieldset>legend', () => {
  const {queryByTestId} = render(`
    <div>
      <fieldset disabled={true}>
        <button data-testid="inherited-element">x</button>
      </fieldset>

      <fieldset disabled={true}>
        <legend>
          <button data-testid="inside-legend-element">x</button>
        </legend>
      </fieldset>

      <fieldset disabled={true}>
        <legend>
          <div>
            <button data-testid="nested-inside-legend-element">x</button>
          </div>
        </legend>
      </fieldset>

      <fieldset disabled={true}>
        <div></div>
        <legend>
          <button data-testid="first-legend-element">x</button>
        </legend>
        <legend>
          <button data-testid="second-legend-element">x</button>
        </legend>
      </fieldset>

      <fieldset disabled={true}>
        <fieldset>
          <legend>
            <button data-testid="outer-fieldset-element">x</button>
          </legend>
        </fieldset>
      </fieldset>
    </div>
    `)

  expect(queryByTestId('inherited-element')).toBeDisabled()
  expect(queryByTestId('inside-legend-element')).toBeDisabled()
  expect(queryByTestId('nested-inside-legend-element')).toBeDisabled()

  expect(queryByTestId('first-legend-element')).toBeDisabled()
  expect(queryByTestId('second-legend-element')).toBeDisabled()

  expect(queryByTestId('outer-fieldset-element')).toBeDisabled()
})

test('.toBeDisabled custom element', () => {
  const {queryByTestId} = render(`
    <custom-element data-testid="disabled-custom-element" disabled=""></custom-element>
    <custom-element data-testid="enabled-custom-element"></custom-element>
  `)

  expect(queryByTestId('disabled-custom-element')).toBeDisabled()
  expect(() => {
    expect(queryByTestId('disabled-custom-element')).not.toBeDisabled()
  }).toThrowError('element is disabled')

  expect(queryByTestId('enabled-custom-element')).not.toBeDisabled()
  expect(() => {
    expect(queryByTestId('enabled-custom-element')).toBeDisabled()
  }).toThrowError('element is not disabled')
})

test('.toBeEnabled', () => {
  const {queryByTestId} = render(`
    <div>
      <button disabled={true} data-testid="button-element">x</button>
      <textarea disabled={true} data-testid="textarea-element"></textarea>
      <input type="checkbox" disabled={true} data-testid="input-element" />

      <fieldset disabled={true} data-testid="fieldset-element">
        <button data-testid="fieldset-child-element">x</button>
      </fieldset>

      <div disabled={true} data-testid="div-element">
        <button data-testid="div-child-element">x</button>
      </div>

      <fieldset disabled={true}>
        <div>
          <button data-testid="nested-form-element">x</button>

          <select data-testid="deep-select-element">
            <optgroup data-testid="deep-optgroup-element">
              <option data-testid="deep-option-element">x</option>
            </optgroup>
          </select>
        </div>
        <a href="http://github.com" data-testid="deep-a-element">x</a>
      </fieldset>

      <a href="http://github.com" disabled={true} data-testid="a-element">x</a>
    </div>
    `)

  expect(() => {
    expect(queryByTestId('button-element')).toBeEnabled()
  }).toThrowError()
  expect(queryByTestId('button-element')).not.toBeEnabled()
  expect(() => {
    expect(queryByTestId('textarea-element')).toBeEnabled()
  }).toThrowError()
  expect(() => {
    expect(queryByTestId('input-element')).toBeEnabled()
  }).toThrowError()

  expect(() => {
    // fieldset elements can't be considered disabled, only their children
    expect(queryByTestId('fieldset-element')).toBeDisabled()
  }).toThrowError()
  expect(() => {
    expect(queryByTestId('fieldset-child-element')).toBeEnabled()
  }).toThrowError()

  expect(queryByTestId('div-element')).toBeEnabled()
  expect(queryByTestId('div-child-element')).toBeEnabled()

  expect(() => {
    expect(queryByTestId('nested-form-element')).toBeEnabled()
  }).toThrowError()
  expect(() => {
    expect(queryByTestId('deep-select-element')).toBeEnabled()
  }).toThrowError()
  expect(() => {
    expect(queryByTestId('deep-optgroup-element')).toBeEnabled()
  }).toThrowError()
  expect(() => {
    expect(queryByTestId('deep-option-element')).toBeEnabled()
  }).toThrowError()

  expect(queryByTestId('a-element')).toBeEnabled()
  expect(() =>
    expect(queryByTestId('a-element')).not.toBeEnabled(),
  ).toThrowError()
  expect(queryByTestId('deep-a-element')).toBeEnabled()
  expect(() =>
    expect(queryByTestId('deep-a-element')).not.toBeEnabled(),
  ).toThrowError()
})

test('.toBeEnabled fieldset>legend', () => {
  const {queryByTestId} = render(`
    <div>
      <fieldset disabled={true}>
        <button data-testid="inherited-element">x</button>
      </fieldset>

      <fieldset disabled={true}>
        <legend>
          <button data-testid="inside-legend-element">x</button>
        </legend>
      </fieldset>

      <fieldset disabled={true}>
        <legend>
          <div>
            <button data-testid="nested-inside-legend-element">x</button>
          </div>
        </legend>
      </fieldset>

      <fieldset disabled={true}>
        <div></div>
        <legend>
          <button data-testid="first-legend-element">x</button>
        </legend>
        <legend>
          <button data-testid="second-legend-element">x</button>
        </legend>
      </fieldset>

      <fieldset disabled={true}>
        <fieldset>
          <legend>
            <button data-testid="outer-fieldset-element">x</button>
          </legend>
        </fieldset>
      </fieldset>
    </div>
    `)

  expect(() => {
    expect(queryByTestId('inherited-element')).toBeEnabled()
  }).toThrowError()
  expect(queryByTestId('inside-legend-element')).not.toBeEnabled()
  expect(queryByTestId('nested-inside-legend-element')).not.toBeEnabled()

  expect(queryByTestId('first-legend-element')).not.toBeEnabled()
  expect(() => {
    expect(queryByTestId('second-legend-element')).toBeEnabled()
  }).toThrowError()

  expect(() => {
    expect(queryByTestId('outer-fieldset-element')).toBeEnabled()
  }).toThrowError()
})

test('.toBeEnabled custom element', () => {
  const {queryByTestId} = render(`
    <custom-element data-testid="disabled-custom-element" disabled=""></custom-element>
    <custom-element data-testid="enabled-custom-element"></custom-element>
  `)

  expect(queryByTestId('disabled-custom-element')).not.toBeEnabled()
  expect(() => {
    expect(queryByTestId('disabled-custom-element')).toBeEnabled()
  }).toThrowError('element is not enabled')

  expect(queryByTestId('enabled-custom-element')).toBeEnabled()
  expect(() => {
    expect(queryByTestId('enabled-custom-element')).not.toBeEnabled()
  }).toThrowError('element is enabled')
})