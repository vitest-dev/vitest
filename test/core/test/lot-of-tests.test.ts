import { describe, expect, it } from 'vitest'

const SUITES = 50
const TASKS = 10

describe(`Suite of ${SUITES * TASKS} tests for UI performance tests`, () => {
  for (let i = 1; i <= SUITES; i++) {
    describe(`Test UI nested describe ${i}`, () => {
      for (let j = 1; j <= TASKS; j++) {
        it(`Test UI it ${i}-${j}`, () => {
          expect(true).toBe(true)
        })
      }
    })
  }
})
