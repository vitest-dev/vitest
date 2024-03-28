import { bench, describe } from "vitest"
import { appendLog, benchOptions, sleep } from "./helper";

bench("B1", async () => {
  await appendLog("F1 / B1")
  await sleep(10);
}, benchOptions)

describe("S1", () => {
  bench("B1", async () => {
    await appendLog("F1 / S1 / B1")
    await sleep(10);
  }, benchOptions)

  bench("B2", async () => {
    await appendLog("F1 / S1 / B2")
    await sleep(10);
  }, benchOptions)
})

describe("S2", () => {
  bench("B1", async () => {
    await appendLog("F1 / S2 / B1")
    await sleep(10);
  }, benchOptions)
})
