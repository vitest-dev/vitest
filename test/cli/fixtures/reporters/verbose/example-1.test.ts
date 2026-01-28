import { test, describe, expect } from "vitest";

test("test pass in root", () => {});

test.skip("test skip in root", () => {});

describe("suite in root", () => {
  test("test pass in 1. suite #1", () => {});

  test("test pass in 1. suite #2", () => {});

  describe("suite in suite", () => {
    test("test pass in nested suite #1", () => {});

    test("test pass in nested suite #2", () => {});

    describe("suite in nested suite", () => {
      test("test failure in 2x nested suite", () => {
        expect("should fail").toBe("as expected");
      });
    });
  });
});

describe.skip("suite skip in root", () => {
  test("test 1.3", () => {});

  describe("suite in suite", () => {
    test("test in nested suite", () => {});

    test("test failure in nested suite of skipped suite", () => {
      expect("should fail").toBe("but should not run");
    });
  });
});
