import { expect, test } from 'vitest'

// drops the jobs above its size limit by mistake
function enqueue(jobs: number[]): number[] {
  return jobs.filter((size) => size <= 500)
}

test('keeps a large job', { examples: [{ jobs: [600] }] }, ({ random }) => {
  const jobs = random.many('jobs', () => random.int(0, 500))
  expect(enqueue(jobs)).toEqual(jobs)
})

test('keeps every job', { repeats: 9 }, ({ random }) => {
  const jobs = random.many('jobs', () => random.int(0, 1000))
  expect(enqueue(jobs)).toEqual(jobs)
})
