import { test, expect } from 'vitest';

test('basic', async () => {
  const div = document.createElement('div')
  div.textContent = ' Vitest'
  document.body.appendChild(div)
  expect(document.body.textContent).toContain('HELLO WORLD')
  expect(document.body.textContent).toContain('Vitest')
})
