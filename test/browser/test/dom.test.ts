import { expect, test } from 'vitest'
import { createNode } from '../src/createNode'

test('render div', async () => {
  const div = createNode()
  expect(div.textContent).toBe('Hello World')
})
