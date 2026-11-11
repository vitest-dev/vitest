import { expect, test } from 'vitest'

// drops duplicate numbers by mistake
function sortNumbers(numbers: number[]): number[] {
  return [...new Set(numbers)].sort((a, b) => a - b)
}

test('keeps every number', { repeats: 9 }, ({ random }) => {
  const numbers = Array.from({ length: 4 }, () => random.int(1, 6))
  expect(sortNumbers(numbers)).toHaveLength(4)
})
