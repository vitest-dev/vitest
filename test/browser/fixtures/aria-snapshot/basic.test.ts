import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('file', () => {
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

test('inline', () => {
  document.body.innerHTML = `
    <button aria-label="User 42">Profile</button>
    <p>You have 7 notifications</p>
  `
  expect(document.body).toMatchAriaInlineSnapshot(`
    - button "User 42": Profile
    - paragraph: You have 7 notifications
  `)
})

test.skip("expect.poll", async () => {
  await expect.poll(async () => {
    document.body.innerHTML = `<p>poll once</p>`;
    return document.body;
  }).toMatchAriaInlineSnapshot()
})

test.skip("expect.element", async () => {
  document.body.innerHTML = `
    <main>
      <h1>Dashboard</h1>
      <nav data-testid="nav">
        <button>Save</button>
        <button>Cancel</button>
      </nav>
    </main>
  `
  await expect.element(page.getByTestId("nav")).toMatchAriaInlineSnapshot()
})
