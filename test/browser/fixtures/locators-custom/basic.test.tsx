import { type Locator, locators, page } from '@vitest/browser/context';
import { beforeEach, expect, test } from 'vitest';
import { getElementLocatorSelectors } from '@vitest/browser/utils'

declare module '@vitest/browser/context' {
  interface LocatorSelectors {
    getByCustomTitle: (title: string) => Locator
    getByNestedTitle: (title: string) => Locator
    updateHtml(this: Locator, html: string): Promise<void>
    updateDocumentHtml(this: BrowserPage, html: string): Promise<void>
  }
}

locators.extend({
  getByCustomTitle(title) {
    return `[data-title="${title}"]`
  },
  getByNestedTitle(title) {
    return `[data-parent] >> [data-title="${title}"]`
  },
  async updateHtml(this: Locator, html) {
    this.element().innerHTML = html
  },
  async updateDocumentHtml(html) {
    document.body.innerHTML = html
  },
})

beforeEach(() => {
  document.body.innerHTML = ''
})

test('new selector works on both page and locator', async () => {
  document.body.innerHTML = `
  <article>
    <h1>Hello World</h1>
    <div data-title="Hello World">Text Content</div>
  </article>
  `

  await expect.element(page.getByCustomTitle('Hello World')).toBeVisible()
  await expect.element(page.getByRole('article').getByCustomTitle('Hello World')).toBeVisible()

  await expect.element(page.getByCustomTitle('NonExisting Title')).not.toBeInTheDocument()
})

test('new nested selector works on both page and locator', async () => {
  document.body.innerHTML = `
  <article>
    <h1>Hello World</h1>
    <div data-parent>
      <div data-title="Hello World">Text Content</div>
    </div>
  </article>
  `

  await expect.element(page.getByNestedTitle('Hello World')).toBeVisible()
  await expect.element(page.getByRole('article').getByNestedTitle('Hello World')).toBeVisible()

  await expect.element(page.getByNestedTitle('NonExisting Title')).not.toBeInTheDocument()
})

test('new added method works on the locator', async () => {
  document.body.innerHTML = `
    <div data-title="Hello World">Text Content</div>
  `

  const title = page.getByCustomTitle('Hello World')

  await expect.element(title).toHaveTextContent('Text Content')

  await title.updateHtml('New Content')

  await expect.element(title).toHaveTextContent('New Content')
})

test('new added method works on the page', async () => {
  document.body.innerHTML = `
    Hello World
  `

  expect(document.body).toHaveTextContent('Hello World')

  await page.updateDocumentHtml('New Content')

  expect(document.body).toHaveTextContent('New Content')
})

test('locators are available from getElementLocatorSelectors', () => {
  const locators = getElementLocatorSelectors(document.body)

  expect(locators.updateHtml).toBeTypeOf('function')
  expect(locators.getByCustomTitle).toBeTypeOf('function')
  expect(locators.updateDocumentHtml).toBeTypeOf('function')
  expect(locators.getByNestedTitle).toBeTypeOf('function')
})
