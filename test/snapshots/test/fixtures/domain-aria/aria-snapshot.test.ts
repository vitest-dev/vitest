// @vitest-environment happy-dom

import { expect, test } from 'vitest'
import { ariaDomainAdapter } from './aria-snapshot'

expect.addSnapshotDomain(ariaDomainAdapter)

test('simple heading and paragraph', () => {
  expect('<h1>Hello World</h1><p>Some description</p>')
    .toMatchDomainSnapshot('aria')
})

test('navigation with links', () => {
  const html = `
    <nav aria-label="Main">
      <ul>
        <li><a href="/home">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  `
  expect(html).toMatchDomainSnapshot('aria')
})

test('form with labelled inputs', () => {
  const html = `
    <form>
      <label for="user">Username</label>
      <input id="user" type="text" />
      <button type="submit">Log in</button>
    </form>
  `
  expect(html).toMatchDomainSnapshot('aria')
})

test('checkbox states', () => {
  const html = `
    <div role="checkbox" aria-checked="true" aria-label="Accept terms"></div>
    <div role="checkbox" aria-checked="mixed" aria-label="Select all"></div>
  `
  expect(html).toMatchDomainSnapshot('aria')
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
  expect(document.body).toMatchDomainSnapshot('aria')
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <button aria-label="User 42">Profile</button>
    <p>You have 7 notifications</p>
  `
  expect(document.body).toMatchDomainSnapshot('aria')
})
