import {test, expect} from "vitest";

// this test causes infinite re-run when --watch and --update
// since snapshot update switches between "foo" and "bar" forever.
test("fail 2", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot(`"bar"`);
  }
});
