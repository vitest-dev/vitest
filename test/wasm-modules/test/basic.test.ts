import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { add } from '../src/add.wasm'

test('supports native wasm imports', () => {
  expect(add(1, 2)).toBe(3)

  // because arguments are i32 (signed), fractional part is truncated
  expect(add(0.99, 1.01)).toBe(1)

  // because return value is i32 (signed), (2^31 - 1) + 1 overflows and becomes -2^31
  expect(add(2 ** 31 - 1, 1)).toBe(-(2 ** 31))

  // invalid or missing arguments are treated as 0
  const addAny = add as any
  expect(addAny('hello', 'world')).toBe(0)
  expect(addAny()).toBe(0)
  expect(addAny(null)).toBe(0)
  expect(addAny({}, [])).toBe(0)

  // redundant arguments are silently ignored
  expect(addAny(1, 2, 3)).toBe(3)
})

test('supports dynamic wasm imports', async () => {
  const { add } = await import('../src/add.wasm')
  expect(add(1, 2)).toBe(3)
})

const wasmFileBuffer = readFileSync(resolve(__dirname, '../src/add.wasm'))

test('supports imports from "data:application/wasm" URI with base64 encoding', async () => {
  const importedWasmModule = await import(
    `data:application/wasm;base64,${wasmFileBuffer.toString('base64')}`
  )
  expect(importedWasmModule.add(0, 42)).toBe(42)
})

// TODO: error message is different on vm
const isVm = process.execArgv.includes('--experimental-vm-modules')

test('imports from "data:application/wasm" URI without explicit encoding fail', async () => {
  const error = await getError(() => import(`data:application/wasm,${wasmFileBuffer.toString('base64')}`))
  if (isVm)
    expect(error).toMatchInlineSnapshot(`[Error: Missing data URI encoding]`)
  else
    expect(error).toMatchInlineSnapshot(`[CompileError: data:application/wasm,AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=: WebAssembly.compile(): expected magic word 00 61 73 6d, found 41 47 46 7a @+0]`)
})

test('imports from "data:application/wasm" URI with invalid encoding fail', async () => {
  // @ts-expect-error import is not typed
  const error = await getError(() => import('data:application/wasm;charset=utf-8,oops'))
  if (isVm)
    expect(error).toMatchInlineSnapshot(`[Error: Invalid data URI encoding: charset=utf-8]`)
  else
    expect(error).toMatchInlineSnapshot(`[CompileError: data:application/wasm;charset=utf-8,oops: WebAssembly.compile(): expected magic word 00 61 73 6d, found 6f 6f 70 73 @+0]`)
})

async function getError(f: () => Promise<void>) {
  try {
    await f()
    expect.unreachable()
  }
  catch (e) {
    return e
  }
}
