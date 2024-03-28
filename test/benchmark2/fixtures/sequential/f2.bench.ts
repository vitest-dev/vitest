import { bench, describe } from "vitest"
import { appendLog, benchOptions, sleep } from "./helper";

describe("S1", () => {
  bench("B1", async () => {
    await appendLog("F2 / S1 / B1")
    await sleep(10);
  }, benchOptions)
})
