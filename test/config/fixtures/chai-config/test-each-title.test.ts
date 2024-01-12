import { expect, test } from 'vitest'

test.each`
  length | param
  ${30}  | ${'0123456789'.repeat(3)}
  ${40}  | ${'0123456789'.repeat(4)}
  ${50}  | ${'0123456789'.repeat(5)}
`('$param (length = $length)', () => {});

test.each`
  param
  ${['one', 'two', 'three']}
  ${['one', 'two', 'three', 'four']}
  ${['one', 'two', 'three', 'four', 'five']}
`('$param', () => {});

test.each`
  param
  ${{ one: 1, two: 2, three: 3 }}
  ${{ one: 1, two: 2, three: 3, four: 4 }}
  ${{ one: 1, two: 2, three: 3, four: 4, five: 5 }}
`('$param', () => {});
