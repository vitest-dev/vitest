import { attest } from "@ark/attest"
import { test, expect, expectTypeOf } from "vitest"

test('compare with expect-type', () => {
  const v = { hello: "world" }

  //
  // type equality: value and type
  //
  expectTypeOf(v).toEqualTypeOf<{ hello: string }>()

  attest<{ hello: string }>(v);
  attest<typeof v, { hello: string}>();
  attest(v).type.toString("{ hello: string }");
  attest(v).type.toString.is("{ hello: string }");
  attest(v).type.toString.equals('{ hello: string }'); // what's the difference?
  expect(attest(v)).toMatchInlineSnapshot(`{ hello: string }`);
  expect(attest(v).type.toString).toMatchInlineSnapshot(`{ hello: string }`);


  //
  // type equality: value to value
  //
  expectTypeOf(v).toEqualTypeOf({ hello: "other-string" })
  // attest(v).type.toString(attest({ hello: "other-string" })) // how?


  //
  // assignability
  //
  expectTypeOf({ x: 0, y: 1 }).toMatchTypeOf<{ x: number }>()
  expectTypeOf({ x: 0, y: 1 }).toMatchTypeOf({ x: 2 })

  attest({ x: 0, y: 1 }).satisfies({ x: 'number' }) // is this arktype syntax?
})
