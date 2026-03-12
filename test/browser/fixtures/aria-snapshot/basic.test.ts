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
    <button aria-label="User 42">Profile</button>
    <p>You have 7 notifications</p>
  `
  expect(document.body).toMatchAriaInlineSnapshot(`
    - button "User 42": Profile
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
