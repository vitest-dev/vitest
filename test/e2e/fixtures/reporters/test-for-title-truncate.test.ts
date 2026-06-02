import { test } from 'vitest'

test.for`
  length | param
  ${30}  | ${'0123456789'.repeat(3)}
  ${40}  | ${'0123456789'.repeat(4)}
  ${50}  | ${'0123456789'.repeat(5)}
`('$ (string: $length) $param', () => {});

test.for`
  length | param
  ${3}   | ${['one', 'two', 'three']}
  ${4}   | ${['one', 'two', 'three', 'four']}
  ${5}   | ${['one', 'two', 'three', 'four', 'five']}
`('$ (array: $length) $param', () => {});

test.for`
  length | param
  ${3}   | ${{ one: 1, two: 2, three: 3 }}
  ${4}   | ${{ one: 1, two: 2, three: 3, four: 4 }}
  ${5}   | ${{ one: 1, two: 2, three: 3, four: 4, five: 5 }}
`('$ (object: $length) $param', () => {});

test.for([
  [30, '0123456789'.repeat(3)],
  [40, '0123456789'.repeat(4)],
  [50, '0123456789'.repeat(5)],
])(`% (string: %d) %o`, () => {})

test.for([
  [3, ['one', 'two', 'three']],
  [4, ['one', 'two', 'three', 'four']],
  [5, ['one', 'two', 'three', 'four', 'five']],
])(`% (array: %d) %o`, () => {})

test.for([
  [3, { one: 1, two: 2, three: 3 }],
  [4, { one: 1, two: 2, three: 3, four: 4 }],
  [5, { one: 1, two: 2, three: 3, four: 4, five: 5 }],
])(`% (object: %d) %o`, () => {})
