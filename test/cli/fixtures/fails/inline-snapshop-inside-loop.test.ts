import {test, expect} from "vitest";

test("ok", () => {
  expect("ok").toMatchInlineSnapshot(`"ok"`);
});

test("fail 1", () => {
  for (const str of ["foo", "bar"]) {
    expect(str).toMatchInlineSnapshot();
  }
});

// this test causes infinite re-run when --watch and --update
// since snapshot update switches between "foo" and "bar" forever.
// test("fail 2", () => {
//   for (const str of ["foo", "bar"]) {
//     expect(str).toMatchInlineSnapshot(`"bar"`);
//   }
// });

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
