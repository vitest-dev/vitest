import { expect, test, vi } from 'vitest'
// @ts-expect-error no type
import * as dep from "@test/test-dep-url"
// @ts-expect-error no type
import * as simple from "test-dep-simple"
// @ts-expect-error no type
import * as simple2 from "test-dep-simple2"

// mock + optimized
vi.mock('@test/test-dep-url', async (importOriginal) => {
  const original = await importOriginal<any>()
  return { ...original,  mocked: "ok" };
})

// mock + not optimized + no external
vi.mock('test-dep-simple', async (importOriginal) => {
  const original = await importOriginal<any>()
  return { ...original,  mocked: "ok" };
})

// mock + not optimized + external
vi.mock('test-dep-simple2', async (importOriginal) => {
  const original = await importOriginal<any>()
  return { ...original,  mocked: "ok" };
})

test('basic', () => {
  expect.soft({...dep}).toEqual({
    mocked: 'ok',
    importMetaUrl: expect.stringContaining('/node_modules/.vite/vitest/')
  })
  expect({...simple}).toEqual({
    mocked: 'ok',
    default: 'test-dep-simple',
  })
  expect({...simple2}).toEqual({
    mocked: 'ok',
    default: 'test-dep-simple2',
  })
})
