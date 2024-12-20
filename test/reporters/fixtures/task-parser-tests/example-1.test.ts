import { beforeAll, beforeEach, afterEach, afterAll, test, describe } from "vitest";
import { setTimeout } from "node:timers/promises";

beforeAll(async () => {
  await setTimeout(100);
});

afterAll(async () => {
  await setTimeout(100);
});

describe("some suite", async () => {
  beforeEach(async () => {
    await setTimeout(100);
  });

  test("some test", async () => {
    await setTimeout(100);
  });

  afterEach(async () => {
    await setTimeout(100);
  });
});

test("Fast test 1", () => {
  //
});

test.skip("Skipped test 1", () => {
  //
});

test.concurrent("parallel slow tests 1.1", async () => {
  await setTimeout(100);
});

test.concurrent("parallel slow tests 1.2", async () => {
  await setTimeout(100);
});
