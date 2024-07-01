import { describe, it } from 'vitest'

// from https://github.com/vitest-dev/vitest/issues/3361
describe.concurrent('concurrent suite', () => {
  it('snapshot', ({ expect }) => {
    expect({ foo: 'bar' }).toMatchSnapshot()
  })

  it('empty test')
})
