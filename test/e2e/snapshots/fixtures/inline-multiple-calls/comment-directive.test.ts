import { expect, test } from 'vitest'

test('block-comment directives, multiple calls', () => {
  expect('alpha').toMatchInlineSnapshot(/* HTML */`"alpha"`)
  expect('beta').toMatchInlineSnapshot(/* HTML */`"beta"`)
  expect('gamma').toMatchInlineSnapshot(/* HTML */`"gamma"`)
})
