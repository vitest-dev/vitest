// @vitest-environment node

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'pathe'
import { expect, it } from 'vitest'

it('correctly resolves new assets URL paths', () => {
  const urlCss = new URL('../src/file-css.css', import.meta.url)
  expect(urlCss.toString()).toBe(
    pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../src/file-css.css')).toString(),
  )
})

it('doesn\'t resolve aliases for new URL in SSR', () => {
  const urlAlias = new URL('#/file-css.css', import.meta.url)
  expect(urlAlias.toString()).toBe(
    pathToFileURL(`${fileURLToPath(import.meta.url)}#/file-css.css`).toString().replace('%23', '#'),
  )
})
