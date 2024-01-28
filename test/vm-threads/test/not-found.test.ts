import { expect, it } from 'vitest'

// @ts-expect-error untyped
import * as notFound from '../src/external/not-found.js'

it('path', async () => {
  await expect(() => notFound.importPath()).rejects.toMatchObject({
    code: 'ERR_MODULE_NOT_FOUND',
    message: expect.stringMatching(/Cannot find module '.*?non-existing-path'/),
  })
})

// NodeJs's import.meta.resolve throws ERR_MODULE_NOT_FOUND error only this case.
// For other cases, similar errors are fabricated by Vitest to mimic NodeJs's behavior.
it('package', async () => {
  await expect(() => notFound.importPackage()).rejects.toMatchObject({
    code: 'ERR_MODULE_NOT_FOUND',
    message: expect.stringContaining('Cannot find package \'@vitest/non-existing-package\''),
  })
})

it('builtin', async () => {
  await expect(() => notFound.importBuiltin()).rejects.toMatchObject({
    code: 'ERR_MODULE_NOT_FOUND',
    message: 'Cannot find module \'node:non-existing-builtin\'',
  })
})

it('namespace', async () => {
  await expect(() => notFound.importNamespace()).rejects.toMatchObject({
    code: 'ERR_MODULE_NOT_FOUND',
    message: 'Cannot find module \'non-existing-namespace:xyz\'',
  })
})
