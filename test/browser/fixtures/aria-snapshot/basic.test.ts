import { expect, test, } from 'vitest'
import { server, page } from 'vitest/browser'

test('toMatchAriaSnapshot simple', () => {
  document.body.innerHTML = `
    <main>
      <h1>Dashboard</h1>
      <nav aria-label="Actions">
        <button>Save</button>
        <button>Cancel</button>
      </nav>
    </main>
  `
  expect(document.body).toMatchAriaSnapshot()
})

test('toMatchAriaInlineSnapshot simple', () => {
  document.body.innerHTML = `
    <p>Original</p>
    <button aria-label="1234">Pattern</button>
  `
  expect(document.body).toMatchAriaInlineSnapshot(`
    - paragraph: Original
    - button "1234": Pattern
  `)
})

test('poll aria once', async () => {
  await expect.poll(async () => {
    document.body.innerHTML = `<p>poll once</p>`
    return document.body
  }).toMatchAriaInlineSnapshot(`- paragraph: poll once`)
})

test('expect.element aria once', async () => {
  document.body.innerHTML = `
    <h1>Hello</h1>
    <p>World</p>
  `
  document.body.setAttribute('data-testid', 'body')
  await expect.element(page.getByTestId('body')).toMatchAriaInlineSnapshot(`
    - heading "Hello" [level=1]
    - paragraph: World
  `)
})

test('expect.element aria retry', async () => {
  document.body.innerHTML = `
    <h1>Hello</h1>
  `
  document.body.setAttribute('data-testid', 'body')
  setTimeout(() => {
    document.body.innerHTML = `
      <h1>Hello</h1>
      <p>World</p>
    `
  }, 10)
  await expect.element(page.getByTestId('body'), { interval: 20 })
    .toMatchAriaInlineSnapshot(`
    - heading "Hello" [level=1]
    - paragraph: World
  `)
})
