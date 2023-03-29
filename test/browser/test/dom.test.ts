import { expect, test } from 'vitest'
import { createNode } from '#src/createNode'

test('renders div', () => {
  const div = createNode()
  expect(div.textContent).toBe('Hello World')
})
