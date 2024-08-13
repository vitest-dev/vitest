import {test, expect} from "vitest";

test("ok", () => {
  expect("ok").toMatchInlineSnapshot(`"ok"`);
});

test("fail 1", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot();
  }
});

test("fail 3", () => {
  for (const str of ["ok", "ok"]) {
    expect(str).toMatchInlineSnapshot();
  }
});

test("somehow ok", () => {
  for (const str of ["ok", "ok"]) {
    expect(str).toMatchInlineSnapshot(`"ok"`);
  }
});
