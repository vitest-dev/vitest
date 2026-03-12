import { expect, test } from 'vitest'
import { page, server } from 'vitest/browser'

test('inline snapshot', () => {
  expect(1).toMatchInlineSnapshot('1')
})

test('snapshot', () => {
  expect(1).toMatchSnapshot()
})

test('file snapshot', async () => {
  await expect('my snapshot content')
    .toMatchFileSnapshot('./__snapshots__/custom/my_snapshot')
})

test('vitest attribute is hidden', () => {
  const div = document.createElement('div')
  div.setAttribute('data-testid', '__vitest_1__')
  expect(div).toMatchInlineSnapshot(`
    <div />
  `)
})

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
    <button aria-label="User 42">Profile</button>
    <p>You have 7 notifications</p>
  `
  // manually updated regex pattern from "User 42" to /User \\d+/
  expect(document.body).toMatchAriaInlineSnapshot(`
    - button /User \\d+/: Profile
    - paragraph: You have 7 notifications
  `)
})

// NOTE: webkit async stack traces is poor. should be fixed on next playwright/webkit release.
test.skipIf(server.browser === 'webkit')('poll aria once', async () => {
  await expect.poll(async () => {
    document.body.innerHTML = `<p>poll once</p>`
    return document.body
  }).toMatchAriaInlineSnapshot(`- paragraph: poll once`)
})

test.skipIf(server.browser === 'webkit')('expect.element aria once', async () => {
  document.body.innerHTML = `
    <main>
      <h1>Dashboard</h1>
      <nav data-testid="nav">
        <button>Save</button>
        <button>Cancel</button>
      </nav>
    </main>
  `
  await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot(`
    - button: Save
    - button: Cancel
  `)
})

test.skipIf(server.browser === 'webkit')('expect.element aria retry', async () => {
  document.body.innerHTML = `
    <main>
      <h1>Dashboard</h1>
    </main>
  `
  setTimeout(() => {
    document.body.innerHTML = `
      <main>
        <h1>Dashboard</h1>
        <nav data-testid="nav">
          <button>Save</button>
          <button>Cancel</button>
        </nav>
      </main>
    `
  }, 100)
  await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot(`
    - button: Save
    - button: Cancel
  `)
})
