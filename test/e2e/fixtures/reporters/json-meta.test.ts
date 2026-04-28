import { expect, test } from 'vitest'

test('pass', ({ task }) => {
  task.meta.custom = 'Passing test added this'
})
