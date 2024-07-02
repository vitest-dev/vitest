import { expect, test } from 'vitest'

import { run } from '../src/multi-transform'

test('cover some branches', () => {
  expect(run('project-2')).toBe(2)

  expect(run('last branch')).toBe(3)
})
