import { Module } from 'node:module'
import { expect, it } from 'vitest'

it('can create modules with incorrect filepath', () => {
  expect(() => new Module('name')).not.toThrow()
  // require will not work for these modules because native createRequire fails
  expect(() => new Module('some-other-name').require('node:url')).toThrow()
})
