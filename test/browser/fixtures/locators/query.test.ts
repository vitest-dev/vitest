import { page } from 'vitest/browser';
import { afterEach, describe, expect, test } from 'vitest';

afterEach(() => {
  document.body.innerHTML = ''
})

test('can find a body element', () => {
  expect(page.elementLocator(document.body).element()).toBe(document.body);
})

test('can find elements inside the body', () => {
  document.body.innerHTML = '<div><span>hello</span></div>'
  const screen = page.elementLocator(document.body)
  expect(screen.getByText('hello').element()).toBe(document.querySelector('span'));
})

describe('locator.and', () => {
  test('can find a button matching multiple criteria', () => {
    document.body.innerHTML = `
    <button title="Testing framework">Vitest</button>
    `
    const locator = page.getByRole('button').and(page.getByTitle('Testing framework'))
    expect(locator.element()).toBe(document.querySelector('button'))
  })

  test('throws an error if matches multiple elements', () => {
    document.body.innerHTML = `
    <button title="Testing framework">Vitest</button>
    <button title="Testing framework">Vitest</button>
    `
    const locator = page.getByRole('button').and(page.getByTitle('Testing framework'))
    expect(() => locator.element()).toThrow(
      `strict mode violation: getByRole('button').and(getByTitle('Testing framework')) resolved to 2 elements`
    )
  })
})

describe('locator.or', () => {
  test('can find a button matching one of the criteria', () => {
    document.body.innerHTML = `
    <button title="Testing framework">Vitest</button>
    `
    const locator1 = page.getByRole('button').or(page.getByTitle('Non-existing title'))
    expect(locator1.element()).toBe(document.querySelector('button'))

    const locator2 = page.getByTitle('Testing framework').or(page.getByRole('alertdialog'))
    expect(locator2.element()).toBe(document.querySelector('button'))
  })

  test('can find a button matching both criteria', () => {
    document.body.innerHTML = `
    <button title="Testing framework">Vitest</button>
    `
    const locator = page.getByRole('button').or(page.getByTitle('Testing framework'))
    expect(locator.element()).toBe(document.querySelector('button'))
  })

  test('throws an error if matches multiple elements', () => {
    document.body.innerHTML = `
    <button title="Testing framework">Vitest</button>
    <a href="https://vitest.dev" title="Testing framework">Vitest</a>
    `
    const locator = page.getByRole('button').or(page.getByTitle('Testing framework'))
    expect(() => locator.element()).toThrow(
      `strict mode violation: getByRole('button').or(getByTitle('Testing framework')) resolved to 2 elements`
    )
  })
})

describe('locator.filter', () => {
  test('can find element with a text inside', () => {
    document.body.innerHTML = `
    <button>Vitest</button>
    `
    const locator = page.getByRole('button').filter({ hasText: 'Vitest' })
    expect(locator.element()).toBe(document.querySelector('button'))
  })

  test('can find element with a text deep inside', () => {
    document.body.innerHTML = `
    <article><div><span>Vitest</span></div></article>
    `
    const locator = page.getByRole('article').filter({ hasText: 'Vitest' })
    expect(locator.element()).toBe(document.querySelector('article'))
  })

  test('can find element with non matching text', () => {
    document.body.innerHTML = `
    <button>Vitest</button>
    `
    const locator1 = page.getByRole('button').filter({ hasNotText: 'Non-existing text' })
    expect(locator1.element()).toBe(document.querySelector('button'))

    const locator2 = page.getByRole('button').filter({ hasNotText: 'Vitest' })
    expect(() => locator2.element()).toThrow(
      `Cannot find element with locator: getByRole('button').filter({ hasNotText: 'Vitest' })`
    )
  })

  test('can find element with non matching text deep inside', () => {
    document.body.innerHTML = `
    <article><div><span>Vitest</span></div></article>
    `
    const locator1 = page.getByRole('article').filter({ hasNotText: 'Non-existing text' })
    expect(locator1.element()).toBe(document.querySelector('article'))

    const locator2 = page.getByRole('article').filter({ hasNotText: 'Vitest' })
    expect(() => locator2.element()).toThrow(
      `Cannot find element with locator: getByRole('article').filter({ hasNotText: 'Vitest' })`
    )
  })

  test('can find element with a locator inside', () => {
    document.body.innerHTML = `
    <article><div><button>Vitest</button></div></article>
    `

    const locator1 = page.getByRole('article').filter({ has: page.getByRole('button') })
    expect(locator1.element()).toBe(document.querySelector('article'))

    const locator2 = page.getByRole('article').filter({ has: page.getByRole('button').filter({ hasText: 'Vitest' }) })
    expect(locator2.element()).toBe(document.querySelector('article'))

    const locator3 = page.getByRole('article').filter({ has: page.getByRole('alert') })
    expect(() => locator3.element()).toThrow(
      `Cannot find element with locator: getByRole('article').filter({ has: getByRole('alert') })`
    )

    // locators reversed
    const locator4 = page.getByRole('button').filter({ has: page.getByRole('article') })
    expect(() => locator4.element()).toThrow(
      `Cannot find element with locator: getByRole('button').filter({ has: getByRole('article') })`
    )

    document.body.innerHTML = `
    <article><div><button>Vitest</button></div></article>
    <article><div><button>Vitest</button></div></article>
    `

    expect(() => locator1.element()).toThrow(
      `strict mode violation: getByRole('article').filter({ has: getByRole('button') }) resolved to 2 elements`
    )
  })

  test('can find element with hasNot', () => {
    document.body.innerHTML = `
    <article><div><button>Vitest</button></div></article>
    `

    const locator1 = page.getByRole('article').filter({ hasNot: page.getByRole('alert') })
    expect(locator1.element()).toBe(document.querySelector('article'))

    const locator2 = page.getByRole('article').filter({ hasNot: page.getByRole('button') })
    expect(() => locator2.element()).toThrow(
      `Cannot find element with locator: getByRole('article').filter({ hasNot: getByRole('button') })`
    )
  })
})
