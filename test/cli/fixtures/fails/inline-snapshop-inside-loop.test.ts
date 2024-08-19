import {test, expect} from "vitest";

test("fail 1", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot();
  }
});

test("fail 2.1", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot(`"foo"`);
  }
});

test("fail 2.2", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot(`"bar"`);
  }
});

test("fail 3", () => {
  for (const str of ["ok", "ok"]) {
    expect(str).toMatchInlineSnapshot();
  }
});

test("fail 4", () => {
  for (const str of ["ok", "ok"]) {
    expect(str).toMatchInlineSnapshot(`"ok"`);
  }
});
