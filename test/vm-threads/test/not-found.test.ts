import process from 'node:process'
import { expect, it } from 'vitest'

// @ts-expect-error untyped
import * as notFound from '../src/external/not-found.js'

const [major, minor] = process.version.slice(1).split('.').map(v => Number(v))

it.runIf(major === 20 && minor >= 6)('path (node >= v20.6)', async () => {
  await expect(() => notFound.importPath()).rejects.toMatchObject({
    message: expect.stringMatching(/\[vitest:vm\] Cannot find module '.*?non-existing-path'/),
  })
})

it.runIf(major === 20 && minor < 6)('path (node < v20.6)', async () => {
  await expect(() => notFound.importPath()).rejects.toMatchObject({
    code: 'ERR_MODULE_NOT_FOUND',
    message: expect.stringMatching(/Cannot find module '.*?non-existing-path'/),
  })
})

it('package', async () => {
  await expect(() => notFound.importPackage()).rejects.toMatchObject({
    code: 'ERR_MODULE_NOT_FOUND',
    message: expect.stringContaining('Cannot find package \'@vitest/non-existing-package\''),
  })
})

it('builtin', async () => {
  await expect(() => notFound.importBuiltin()).rejects.toMatchObject({
    message: '[vitest:vm] Cannot find module \'node:non-existing-builtin\'',
  })
})

it('namespace', async () => {
  await expect(() => notFound.importNamespace()).rejects.toMatchObject({
    message: '[vitest:vm] Cannot find module \'non-existing-namespace:xyz\'',
  })
})
