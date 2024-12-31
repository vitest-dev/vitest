import { page } from '@vitest/browser/context'
import { expect, test, vi } from 'vitest'

// element selector uses prettyDOM under the hood, which is an expensive call
// that should not be called on each failed locator attempt to avoid memory leak:
// https://github.com/vitest-dev/vitest/issues/7139
test('should only use element selector on last expect.element attempt', async () => {
  const div = document.createElement('div')
  const spanString = '<span>test</span>'
  div.innerHTML = spanString
  document.body.append(div)

  const locator = page.getByText('non-existent')
  const locatorElementMock = vi.fn(locator.element)
  locator.element = locatorElementMock
  const locatorQueryMock = vi.fn(locator.query)
  locator.query = locatorQueryMock

  try {
    await expect.element(locator, { timeout: 500, interval: 100 }).toBeInTheDocument()
  }
  catch {}

  expect(locatorElementMock).toBeCalledTimes(1)
  expect(locatorElementMock).toHaveBeenCalledAfter(locatorQueryMock)
})
