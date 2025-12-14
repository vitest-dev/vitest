import { expect, test } from "vitest";

test("test should pass", () => {
    expect(2).toBe(2)
})

test("test should repeat 2 times", { repeats: 2 }, () => {
    expect(2).toBe(2)
})