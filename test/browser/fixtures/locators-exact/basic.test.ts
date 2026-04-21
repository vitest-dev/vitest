import { page } from 'vitest/browser'
import { afterEach, describe, expect, test } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('exact: true global default', () => {
  test('getByText finds an exact text match', () => {
    document.body.innerHTML = '<span>Hello</span>'
    const screen = page.elementLocator(document.body)
    expect(screen.getByText('Hello').element()).toBe(document.querySelector('span'))
  })

  test('getByText does not find a substring match', () => {
    document.body.innerHTML = '<span>Hello World</span>'
    const screen = page.elementLocator(document.body)
    expect(() => screen.getByText('Hello').element()).toThrow(
      'Cannot find element',
    )
  })

  test('getByText is case-sensitive', () => {
    document.body.innerHTML = '<span>Hello</span>'
    const screen = page.elementLocator(document.body)
    expect(() => screen.getByText('hello').element()).toThrow(
      'Cannot find element',
    )
  })

  test('getByText finds a full text match with multiple words', () => {
    document.body.innerHTML = '<span>Hello World</span>'
    const screen = page.elementLocator(document.body)
    expect(screen.getByText('Hello World').element()).toBe(document.querySelector('span'))
  })

  test('per-call exact: false overrides the global default', () => {
    document.body.innerHTML = '<span>Hello</span>'
    const screen = page.elementLocator(document.body)
    expect(screen.getByText('hello', { exact: false }).element()).toBe(document.querySelector('span'))
  })
})
