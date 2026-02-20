import { beforeEach, expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.body.innerHTML = ''
})

test('locator.findElement can find the element if it exists', async () => {
  const button = createButton()

  const element = await page.getByRole('button').findElement()
  expect(element).toBeInTheDocument()
  expect(button).toBe(element)
})

test('locator.findElement can find the element if it appears', async () => {
  let button: HTMLButtonElement

  setTimeout(() => {
    button = createButton()
  }, 50)

  const element = await page.getByRole('button').findElement()
  expect(element).toBeInTheDocument()
  expect(button).toBe(element)
})

test('locator.findElement fails if it cannot find the element', async () => {
  const locator = page.getByRole('button')
  const elementsSpy = vi.spyOn(locator, 'elements')
  await expect(() => {
    return locator.findElement({ timeout: 100 })
  }).rejects.toThrow('Cannot find element with locator: getByRole(\'button\')')
  // Normally it would be 5:
  // Immidiate, 0 (next tick), 20, 50, 100
  // But on CI it can be less because resources are limited
  expect(elementsSpy.mock.calls.length).toBeGreaterThanOrEqual(3)
})

test('locator.findElement fails if there are multiple elements by default', async () => {
  createButton()
  createButton()

  await expect(
    () => page.getByRole('button').findElement(),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    [Error: strict mode violation: getByRole('button') resolved to 2 elements:
        1) <button></button> aka getByRole('button').first()
        2) <button></button> aka getByRole('button').nth(1)
    ]
  `)
})

test('locator.findElement fails if there are multiple elements if strict mode is specified', async () => {
  createButton()
  createButton()

  await expect(
    () => page.getByRole('button').findElement({ strict: true }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    [Error: strict mode violation: getByRole('button') resolved to 2 elements:
        1) <button></button> aka getByRole('button').first()
        2) <button></button> aka getByRole('button').nth(1)
    ]
  `)
})

test('locator.findElement fails if multiple elements appear later with strict mode', async () => {
  setTimeout(() => {
    createButton()
    createButton()
  }, 50)

  await expect(
    () => page.getByRole('button').findElement(),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`
    [Error: strict mode violation: getByRole('button') resolved to 2 elements:
        1) <button></button> aka getByRole('button').first()
        2) <button></button> aka getByRole('button').nth(1)
    ]
  `)
})

test('locator.findElement returns the first button if strict is disabled', async () => {
  const button = createButton()
  createButton()

  const element = await page.getByRole('button').findElement({ strict: false })
  expect(element).toBeInTheDocument()
  expect(button).toBe(element)
})

test('locator.findElement returns the first button if strict is disabled after element appears', async () => {
  let button: HTMLButtonElement

  setTimeout(() => {
    button = createButton()
    createButton()
  }, 50)

  const element = await page.getByRole('button').findElement({ strict: false })
  expect(element).toBeInTheDocument()
  expect(button).toBe(element)
})

function createButton() {
  const button = document.createElement('button')
  document.body.append(button)
  return button
}
