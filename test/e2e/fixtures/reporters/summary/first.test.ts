import { setTimeout } from 'node:timers/promises'
import { describe, test } from 'vitest'

const TIMEOUT = 100;

// Test queue time
await setTimeout(TIMEOUT);

describe("suite", () => {
  test("one",async () => {
    await setTimeout(TIMEOUT);
  })

  test("two", async () => {
    await setTimeout(TIMEOUT);
  })

  test("three", async () => {
    await setTimeout(TIMEOUT);
  })
})
