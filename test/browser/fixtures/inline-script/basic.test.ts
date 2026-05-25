import { expect, inject, test } from 'vitest'

test('provide', () => {
  expect(inject('someKey' as never)).toBe('</script><h1>inject1</h1><!--')
})
