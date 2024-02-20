// eslint-disable-next-line unicorn/prefer-node-protocol
import * as url from 'url'
import { expect, test } from 'vitest'

test('url is polifylled because it\'s installed in dependencies', () => {
  expect(url.format).toBeDefined()
})
