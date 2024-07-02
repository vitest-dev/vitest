import { afterAll, test } from 'vitest'

declare module 'vitest' {
  interface TaskMeta {
    done?: boolean
    custom?: string
  }
}

afterAll((suite) => {
  suite.meta.done = true
})

test('custom', ({ task }) => {
  task.meta.custom = 'some-custom-hanlder'
})

test.each([1, 2])('custom %s', () => {
  // support locations
})
