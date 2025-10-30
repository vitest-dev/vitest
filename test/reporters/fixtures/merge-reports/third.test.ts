import { describe, expect, it } from 'vitest'

const cases = [
  {
    actual: [
      "Lorem ipsum dolor sit amet consectetur",
      "adipiscing elit sed do eiusmod tempor",
    ],
    expected: [
      "adipiscing elit sed do eiusmod tempor",
      "incididunt ut labore et dolore magna",
    ],
  },
  {
    actual: [
      "aliqua Ut enim ad minim veniam",
      "quis nostrud exercitation ullamco laboris nisi",
    ],
    expected: [
      "ut aliquip ex ea commodo consequat",
      "Duis aute irure dolor in reprehenderit...",
    ],
  },
];

it.each(cases)('test 3-%$', ({ actual, expected }) => {
  expect(actual).toEqual(expect.arrayContaining(expected))
})
