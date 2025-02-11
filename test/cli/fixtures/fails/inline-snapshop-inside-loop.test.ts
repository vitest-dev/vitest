import {test, expect} from "vitest";

test("fail 1", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot();
  }
});