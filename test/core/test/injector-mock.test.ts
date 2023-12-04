import { expect, test } from 'vitest'
import { hoistMocks } from '../../../packages/vitest/src/node/hoistMocks'

async function hoistSimpleCode(code: string) {
  return (await hoistMocks(code))?.code
}

test('hoists mock, unmock, hoisted', async () => {
  expect(await hoistSimpleCode(`
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  `)).toMatchInlineSnapshot(`
    "vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})




      "
  `)
})

test('always hoists import from vitest', async () => {
  expect(await hoistSimpleCode(`
  import { vi } from 'vitest'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})

      import { vi } from 'vitest'



      import { test } from 'vitest'
      "
  `)
})

test('always hoists all imports but they are under mocks', async () => {
  expect(await hoistSimpleCode(`
  import { vi } from 'vitest'
  import { someValue } from './path.js'
  import { someValue2 } from './path2.js'
  vi.mock('path', () => {})
  vi.unmock('path')
  vi.hoisted(() => {})
  import { test } from 'vitest'
  `)).toMatchInlineSnapshot(`
    "vi.mock('path', () => {})
    vi.unmock('path')
    vi.hoisted(() => {})

      import { vi } from 'vitest'
      import { someValue } from './path.js'
      import { someValue2 } from './path2.js'



      import { test } from 'vitest'
      "
  `)
})

test('correctly mocks namespaced', async () => {
  expect(await hoistSimpleCode(`
  import { vi } from 'vitest'
  import add, * as AddModule from '../src/add'
  vi.mock('../src/add', () => {})
  `)).toMatchInlineSnapshot(`
    "vi.mock('../src/add', () => {})

      import { vi } from 'vitest'
      import add, * as AddModule from '../src/add'

      "
  `)
})
