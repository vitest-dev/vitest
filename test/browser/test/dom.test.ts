import { expect, test } from 'vitest'
import { createNode } from '#src/createNode'

test('renders div', () => {
  const div = createNode()
  document.body.style.background = '#f3f3f3'
  expect(div.textContent).toBe('Hello World')
})
