/**
 * @vitest-environment happy-dom
 * @vitest-environment-options { "url": "http://my-website:5435", "settings": { "disableCSSFileLoading": true } }
 */

/* eslint-disable vars-on-top */

import { expect, it } from 'vitest'

declare global {
  // eslint-disable-next-line no-var
  var happyDOM: any
}

it('custom URL is changed to my-website:5435', () => {
  expect(location.href).toBe('http://my-website:5435/')
})

it('accepts custom environment options', () => {
  // default is false
  expect(window.happyDOM?.settings.disableCSSFileLoading).toBe(true)
})
