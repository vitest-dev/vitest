// @vitest-environment happy-dom

import { expect, test } from 'vitest'

test('simple heading and paragraph', () => {
  document.body.innerHTML = '<h1>Hello World</h1><p>Some description</p>'
  expect(document.body).toMatchAriaSnapshot()
})

test('navigation with links', () => {
  document.body.innerHTML = `
    <nav aria-label="Main">
      <ul>
        <li><a href="/home">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  `
  expect(document.body).toMatchAriaSnapshot()
})

test('form with labelled inputs', () => {
  document.body.innerHTML = `
    <form>
      <label for="user">Username</label>
      <input id="user" type="text" />
      <button type="submit">Log in</button>
    </form>
  `
  expect(document.body).toMatchAriaSnapshot()
})

test('checkbox states', () => {
  document.body.innerHTML = `
    <div role="checkbox" aria-checked="true" aria-label="Accept terms"></div>
    <div role="checkbox" aria-checked="mixed" aria-label="Select all"></div>
  `
  expect(document.body).toMatchAriaSnapshot()
})

test('expect(element) - capture from DOM element', () => {
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

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <button aria-label="User 42">Profile</button>
    <p>You have 7 notifications</p>
  `
  expect(document.body).toMatchAriaSnapshot()
})
