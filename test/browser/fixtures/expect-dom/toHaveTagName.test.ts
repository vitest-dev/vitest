import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from './utils'

describe('.toHaveTagName', () => {
  test('works with HTML and SVG elements', () => {
    const { queryByTestId } = render(`
      <button data-testid="button">Submit</button>
      <svg data-testid="icon"></svg>
    `)

    const button = queryByTestId('button')
    const icon = queryByTestId('icon')

    expect(button).toHaveTagName('button')
    expect(button).not.toHaveTagName('a')
    expect(icon).toHaveTagName('svg')
    expect(icon).not.toHaveTagName('div')
  })

  test('supports locators and `expect.element`', async () => {
    render(`
      <button data-testid="button">Submit</button>
    `)

    const button = page.getByTestId('button')

    expect(button).toHaveTagName('button')
    expect(button).not.toHaveTagName('a')
    await expect.element(button).toHaveTagName('button')
    await expect.element(button).not.toHaveTagName('a')
  })

  test('supports asymmetric matchers', () => {
    const { queryByTestId } = render(`
      <button data-testid="button">Submit</button>
    `)

    const button = queryByTestId('button')

    expect(button).toHaveTagName(expect.stringContaining('on'))
    expect(button).not.toHaveTagName(expect.stringContaining('a'))
  })

  test('throws on failed expectations and invalid targets', () => {
    const { queryByTestId } = render(`
      <button data-testid="button">Submit</button>
    `)

    const button = queryByTestId('button')

    expect(() => {
      expect(button).toHaveTagName('a')
    }).toThrow(/expected element to have tag name/i)

    expect(() => {
      expect(button).not.toHaveTagName('button')
    }).toThrow(/expected element not to have tag name/i)

    expect(() => {
      expect('not-an-element').toHaveTagName('p')
    }).toThrow(/an HTMLElement or an SVGElement/i)

    // @ts-expect-error tag names should be lowercased
    expect(button).toHaveTagName('BUTTON')
  })
})
