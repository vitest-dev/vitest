import { page } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';

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