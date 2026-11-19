import { createRandomSource, setRandomExample } from '@vitest/utils/random-source'
import { describe, expect, test } from 'vitest'
import { RandomExample } from '../../../packages/vitest/src/runtime/runner/example'

const RUN_SEED = '0000000000000000'

describe('RandomExample', () => {
  function createExampleSource(values: Record<string, unknown>) {
    const random = createRandomSource(RUN_SEED)
    const example = new RandomExample(values)
    setRandomExample(random, example)
    return { random, example }
  }

  test('an outer span or many with a key returns the value and reads no numbers', () => {
    const { random, example } = createExampleSource({ user: { name: 'Alice' }, jobs: [501] })
    const user = random.span('user', () => ({ name: random.pick(['Bob', 'Carol']) }))
    const jobs = random.many('jobs', () => random.int(0, 1000))
    expect({ user, jobs }).toEqual({ user: { name: 'Alice' }, jobs: [501] })
    expect(random.uint32()).toBe(createRandomSource(RUN_SEED).uint32())
    expect(example.getUnusedKeys()).toEqual([])
  })

  test('a call without a key runs its function', () => {
    const { random, example } = createExampleSource({})
    expect(random.span('id', () => random.uuid())).toBe(createRandomSource(RUN_SEED).uuid())
    expect(example.getCallPaths()).toEqual(['id'])
  })

  test('a span inside another span is not a key', () => {
    const { random, example } = createExampleSource({ item: 'unused' })
    const order = random.span('order', () => ({ item: random.span('item', () => 'book') }))
    expect(order).toEqual({ item: 'book' })
    expect(example.getUnusedKeys()).toEqual(['item'])
  })

  test('a span inside a span of a fork is not a key', () => {
    const { random, example } = createExampleSource({ network: { delay: 5 } })
    const network = random.fork('network')
    random.span('cluster', () => network.span('delay', () => network.int(10, 100)))
    expect(example.getUnusedKeys()).toEqual(['network'])
  })

  test('the values of a fork are in an object with the label of the fork', () => {
    const { random, example } = createExampleSource({
      network: { faults: { drop: true } },
      delay: 5,
    })
    const faults = random.fork('network').fork('faults')
    expect(faults.span('drop', () => false)).toBe(true)
    expect(random.fork('timers').span('delay', () => 0)).toBe(0)
    expect(example.getUnusedKeys()).toEqual(['delay'])
    expect(example.getCallPaths()).toEqual(['network.faults.drop', 'timers.delay'])
  })

  test('a label that runs more than 1 time takes 1 value of `$label` for each call', () => {
    const { random, example } = createExampleSource({ $user: ['Alice', 'Bob'] })
    const users = ['a', 'b', 'c'].map((name) => random.span('user', () => name))
    expect(users).toEqual(['Alice', 'Bob', 'c'])
    expect(example.getUnusedKeys()).toEqual([])

    const more = createExampleSource({ $user: ['Alice', 'Bob', 'Carol'] })
    more.random.span('user', () => 'a')
    expect(more.example.getUnusedKeys()).toEqual(['$user[1]', '$user[2]'])
  })

  test('a key without `$` fails at the second call of its label', () => {
    const { random } = createExampleSource({ user: 'Alice' })
    expect(random.span('user', () => 'a')).toBe('Alice')
    expect(() => random.span('user', () => 'b')).toThrowErrorMatchingInlineSnapshot(
      `[Error: random.span("user") runs more than 1 time. Use "$user" in the example with 1 value for each call.]`,
    )
  })

  test('a key that is both the values of a fork and a value throws', () => {
    const { random } = createExampleSource({ network: { delay: 5 } })
    random.fork('network').span('delay', () => 0)
    expect(() => random.span('network', () => 0)).toThrowErrorMatchingInlineSnapshot(
      `[Error: random.fork("network").span("delay") reads the example key "network" as the values of a fork, and random.span("network") reads it as a value. Rename 1 of the labels.]`,
    )
  })

  test('the values of a fork and `$label` are checked when a call reads them', () => {
    const both = createExampleSource({ network: { delay: 5, $delay: [5] } })
    expect(() =>
      both.random.fork('network').span('delay', () => 0),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: The example has the keys "network.delay" and "network.$delay". Use only "network.$delay", with 1 value for each call.]`,
    )
    const list = createExampleSource({ $delay: 5 })
    expect(() => list.random.span('delay', () => 0)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: The example has the key "$delay" with a value that is not an array, received number. Use an array with 1 value for each call.]`,
    )
    const empty = createExampleSource({ network: { $delay: [] } })
    expect(() =>
      empty.random.fork('network').span('delay', () => 0),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: The example has the key "network.$delay" with an empty array. Use an array with 1 value for each call.]`,
    )
  })

  test('a key that is not an identifier is in brackets, as a JavaScript property', () => {
    const { random, example } = createExampleSource({
      '@scope/pkg': { 'node-id': 1, $node: ['a', 'b', 'c'] },
    })
    random.fork('@scope/pkg').span('node', () => '')
    expect(example.getUnusedKeys()).toEqual([
      `['@scope/pkg']['node-id']`,
      `['@scope/pkg'].$node[1]`,
      `['@scope/pkg'].$node[2]`,
    ])
    expect(example.getCallPaths()).toEqual([`['@scope/pkg'].node`])
  })

  test('a call that throws closes its span', () => {
    const { random } = createExampleSource({ user: 'Alice' })
    expect(() =>
      random.span('order', () => {
        throw new Error('no stock')
      }),
    ).toThrow('no stock')
    expect(random.span('user', () => 'Bob')).toBe('Alice')
  })
})
