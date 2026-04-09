import { expect, test } from 'vitest'

test('different libraries', async ({ bench }) => {
  const result = await bench.run(
    bench('lib 1', () => {}),
    bench('lib 2', () => {}),
    bench('lib 3', () => {}),
    {
      iterations: 1,
      time: 1,
    },
  )
  expect(result.get('lib 1')).toBeFasterThan(result.get('lib 2'))
  expect(result.get('lib 1')).toBeSlowerThan(result.get('lib 2'))
  // console.log(result2)
})
