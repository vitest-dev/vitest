import {test, expect} from "vitest";

test("fail 1", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot(`"foo"`);
  }
});

test("fail 2.1", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot(`"bar"`);
  }
});

test("fail 2.2", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot(`"foo"`);
  }
});
