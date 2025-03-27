import { expect, test } from 'vitest'
import { render } from './utils'

test('.toHaveAttribute', () => {
  const {queryByTestId} = render(`
    <button data-testid="ok-button" type="submit" disabled>
      OK
    </button>
    <svg data-testid="svg-element" width="12"></svg>
  `)

  expect(queryByTestId('ok-button')).toHaveAttribute('disabled')
  expect(queryByTestId('ok-button')).toHaveAttribute('type')
  expect(queryByTestId('ok-button')).not.toHaveAttribute('class')
  expect(queryByTestId('ok-button')).toHaveAttribute('type', 'submit')
  expect(queryByTestId('ok-button')).not.toHaveAttribute('type', 'button')
  expect(queryByTestId('svg-element')).toHaveAttribute('width')
  expect(queryByTestId('svg-element')).toHaveAttribute('width', '12')
  expect(queryByTestId('ok-button')).not.toHaveAttribute('height')

  expect(() =>
    expect(queryByTestId('ok-button')).not.toHaveAttribute('disabled'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('ok-button')).not.toHaveAttribute('type'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('ok-button')).toHaveAttribute('class'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('ok-button')).not.toHaveAttribute('type', 'submit'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('ok-button')).toHaveAttribute('type', 'button'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('svg-element')).not.toHaveAttribute('width'),
  ).toThrowError()
  expect(() =>
    expect(queryByTestId('svg-element')).not.toHaveAttribute('width', '12'),
  ).toThrowError()
  expect(() =>
    // @ts-expect-error invalid signature
    expect({thisIsNot: 'an html element'}).not.toHaveAttribute(),
  ).toThrowError()

  // Asymmetric matchers
  expect(queryByTestId('ok-button')).toHaveAttribute(
    'type',
    expect.stringContaining('sub'),
  )
  expect(queryByTestId('ok-button')).toHaveAttribute(
    'type',
    expect.stringMatching(/sub*/),
  )
  expect(queryByTestId('ok-button')).toHaveAttribute('type', expect.anything())

  expect(() =>
    expect(queryByTestId('ok-button')).toHaveAttribute(
      'type',
      expect.not.stringContaining('sub'),
    ),
  ).toThrowError()
})