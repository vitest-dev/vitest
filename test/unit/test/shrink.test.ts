import type { RandomSource } from '@vitest/utils/random-source'
import type { RandomTapeRecord } from '@vitest/utils/random-tape'
import type { ShrinkOptions } from '../../../packages/vitest/src/runtime/runner/shrink'
import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'
import { RandomTape } from '@vitest/utils/random-tape'
import { describe, expect, test } from 'vitest'
import {
  compareTapes,
  countValues,
  shrinkTape,
} from '../../../packages/vitest/src/runtime/runner/shrink'

// the first seed for which the check fails
function findFailingSeed<T>(generate: (random: RandomSource) => T, check: (value: T) => boolean) {
  for (let i = 0; i < 10_000; i++) {
    const seed = deriveSeed(['shrink', String(i)])
    if (!check(generate(createRandomSource(seed)))) {
      return seed
    }
  }
  throw new Error('No seed fails the check.')
}

// runs the check with the values of a tape, as a test attempt does. The initial value is the
// first one that fails `initialCheck`.
async function shrink<T>(
  generate: (random: RandomSource) => T,
  check: (value: T) => boolean,
  {
    initialCheck = check,
    ...options
  }: Partial<ShrinkOptions> & { initialCheck?: (value: T) => boolean } = {},
) {
  const seed = findFailingSeed(generate, initialCheck)
  const recording = new RandomTape()
  const initial = generate(recording.createSource(seed))
  const result = await shrinkTape(
    recording.getRecords(),
    async (streams) => {
      const tape = new RandomTape({ streams, maxExtraReads: 1000 })
      let same: boolean
      try {
        same = !check(generate(tape.createSource(seed)))
      } catch {
        same = false
      }
      return { same, records: tape.getRecords() }
    },
    { now: () => 0, deadline: 1, maxRuns: 10_000, ...options },
  )
  const tape = new RandomTape({ streams: result.records })
  return { initial, shrunk: generate(tape.createSource(seed)), result }
}

describe('shrinkTape', () => {
  test('finds the smallest value that fails', async () => {
    const { initial, shrunk } = await shrink(
      (random) => random.many('jobs', () => random.int(0, 1000)),
      (values) => values.every((value) => value <= 500),
      { initialCheck: (values) => values.length < 2 || values.every((value) => value <= 500) },
    )
    expect(initial.length).toBeGreaterThan(1)
    expect(shrunk).toEqual([501])
  })

  test('moves a byte that causes the failure to the start of its value', async () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const { initial, shrunk } = await shrink(
      (random) => Array.from(random.bytes(6), (byte) => alphabet[byte % alphabet.length]).join(''),
      (code) => !/[IO]/.test(code),
    )
    expect({ initial, shrunk }).toMatchInlineSnapshot(`
      {
        "initial": "2IHQPM",
        "shrunk": "IAAAAA",
      }
    `)
  })

  test('removes the items that do not cause the failure', async () => {
    const { shrunk } = await shrink(
      (random) => random.many('jobs', () => random.int(0, 100), { average: 20 }),
      // fails if a 7 comes before a value above 50
      (values) => !values.some((value, i) => value === 7 && values.slice(i).some((v) => v > 50)),
    )
    expect(shrunk).toEqual([7, 51])
  })

  test('removes the next parts at the same level with few runs', async () => {
    const sizes: number[] = []
    const { initial, shrunk } = await shrink(
      (random) => random.many('jobs', () => random.int(0, 100), { average: 500 }),
      (values) => values.length < 3,
      {
        initialCheck: (values) => values.length <= 100,
        onProgress: ({ values }) => sizes.push(values),
      },
    )
    expect(initial.length).toBeGreaterThan(100)
    expect(shrunk).toEqual([0, 0, 0])
    // 3 items read at most 7 values; 1 run for each removed item would need more than 100 runs
    expect(sizes.findIndex((size) => size <= 7)).toBeLessThan(30)
  })

  test('replaces a part with a smaller part of the same kind', async () => {
    interface Tree {
      children: Tree[]
    }
    const generate = (random: RandomSource, depth = 0): Tree =>
      random.span('tree', () => ({
        children:
          depth < 4 ? random.many('children', () => generate(random, depth + 1), { max: 3 }) : [],
      }))
    const height = (tree: Tree): number => 1 + Math.max(0, ...tree.children.map(height))
    const { shrunk } = await shrink(generate, (tree) => height(tree) < 3)
    expect(shrunk).toEqual({ children: [{ children: [{ children: [] }] }] })
  })

  test('shrinks each fork without a change of the other forks', async () => {
    const { shrunk } = await shrink(
      (random) => {
        const network = random.fork('network')
        const faults = random.fork('faults')
        return {
          delays: network.many('delays', () => network.int(0, 100)),
          drops: faults.many('drops', () => faults.bool(0.3)),
        }
      },
      ({ delays, drops }) => !(delays.some((delay) => delay > 90) && drops.includes(true)),
    )
    expect(shrunk).toEqual({ delays: [91], drops: [true] })
  })

  test('removes an item of `many` with the values that it read from a fork', async () => {
    const { shrunk } = await shrink(
      (random) => {
        const keys = random.fork('keys')
        return random.many('ops', () => ({
          kind: random.pick(['put', 'del']),
          key: keys.int(0, 9),
        }))
      },
      (ops) => {
        // the cache never deletes the keys 5 to 9
        const cache = new Set<number>()
        const model = new Set<number>()
        for (const { kind, key } of ops) {
          if (kind === 'put') {
            cache.add(key)
            model.add(key)
          } else {
            if (key < 5) {
              cache.delete(key)
            }
            model.delete(key)
          }
        }
        return [...cache].sort().join() === [...model].sort().join()
      },
    )
    expect(shrunk).toMatchInlineSnapshot(`
      [
        {
          "key": 6,
          "kind": "put",
        },
        {
          "key": 6,
          "kind": "del",
        },
      ]
    `)
  })

  test('stops after the maximum count of runs', async () => {
    const { result } = await shrink(
      (random) => random.many('jobs', () => random.int(0, 1000), { average: 50 }),
      (values) => values.every((value) => value <= 500),
      { maxRuns: 5 },
    )
    expect(result.runs).toBe(5)
  })

  test('makes each value smaller when no other change fails', async () => {
    // a cache of 32 keys fails only with 32 different keys, so a removed key or a key of 0 passes
    const { initial, shrunk } = await shrink(
      (random) => Array.from({ length: 42 }, () => random.int(0, 10_000)),
      (keys) => new Set(keys).size < 32,
    )
    expect(new Set(initial).size).toBeGreaterThan(32)
    expect(shrunk).toEqual([
      ...Array.from({ length: 11 }, () => 0),
      ...Array.from({ length: 31 }, (_, i) => i + 1),
    ])
  })

  test('does not keep an input that makes the test read more values', async () => {
    // a raw 0 gives 'add', so a tape of zeros fills the cart with 10 items
    const { initial, shrunk } = await shrink(
      (random) => {
        const cart: string[] = []
        for (let i = 0; i < 10; i++) {
          if (random.pick(['add', 'checkout']) === 'checkout') {
            break
          }
          cart.push(`item ${i}`)
        }
        return cart
      },
      (cart) => cart.length <= 3,
      { initialCheck: (cart) => cart.length !== 4 },
    )
    expect(initial).toHaveLength(4)
    expect(shrunk).toEqual(['item 0', 'item 1', 'item 2', 'item 3'])
  })

  test('stops after a loop of runs without a smaller input', async () => {
    const generate = (random: RandomSource) => Array.from({ length: 300 }, () => random.uint32())
    // only the values of the first seed fail
    const failing = generate(createRandomSource(deriveSeed(['shrink', '0']))).join()
    const { result } = await shrink(generate, (values) => values.join() !== failing)
    expect(result).toMatchObject({ shrunk: false, timedOut: false })
    expect(result.runs).toMatchInlineSnapshot(`884`)
  })

  test('reports a stop at the deadline and the progress of each run', async () => {
    const recording = new RandomTape()
    recording.createSource(deriveSeed(['shrink', '0'])).bytes(40)
    const progress: { runs: number; values: number }[] = []
    let time = 0
    const result = await shrinkTape(
      recording.getRecords(),
      async () => ({ same: false, records: [] }),
      {
        now: () => time++,
        deadline: 10,
        onProgress: (entry) => progress.push(entry),
      },
    )
    expect(result.timedOut).toBe(true)
    expect(progress.at(-1)).toEqual({ runs: result.runs, values: 10 })
    expect(countValues(result.records)).toBe(10)
  })

  test('skips an input that reads the same values as a run that was too slow', async () => {
    const generate = (random: RandomSource) => random.many('jobs', () => random.int(0, 1000))
    const seed = findFailingSeed(generate, (values) => values.every((value) => value <= 500))
    const recording = new RandomTape()
    generate(recording.createSource(seed))
    const slowReads: string[] = []
    const result = await shrinkTape(
      recording.getRecords(),
      async (streams) => {
        const tape = new RandomTape({ streams, maxExtraReads: 1000 })
        const values = generate(tape.createSource(seed))
        const records = tape.getRecords()
        // a test that waits for the first value, so it never ends without values
        if (!values.length) {
          slowReads.push(JSON.stringify(records.map(({ values, length }) => [values, length])))
          return { same: false, slow: true, records }
        }
        return { same: values.some((value) => value > 500), records }
      },
      { now: () => 0, deadline: 1 },
    )
    const shrunk = generate(new RandomTape({ streams: result.records }).createSource(seed))
    expect(shrunk).toEqual([501])
    expect(slowReads.length).toBeGreaterThan(0)
    expect(new Set(slowReads).size).toBe(slowReads.length)
  })

  test('keeps the initial input if no smaller input fails', async () => {
    // only the raw value of the first seed fails
    const failing = createRandomSource(deriveSeed(['shrink', '0'])).uint32()
    const { result } = await shrink(
      (random) => random.uint32(),
      (value) => value !== failing,
    )
    expect(result.shrunk).toBe(false)
    expect(result.records).toEqual([
      { path: [], values: [expect.any(Number)], length: 1, spans: expect.any(Array) },
    ])
  })
})

describe('compareTapes', () => {
  const tape = (...streams: [string[], number[]][]): RandomTapeRecord[] =>
    streams.map(([path, values]) => ({ path, values, length: values.length, spans: [] }))

  test('a tape with fewer values is smaller', () => {
    expect(compareTapes(tape([[], [9]]), tape([[], [1, 1]]))).toBeLessThan(0)
    expect(
      compareTapes(tape([['network'], [9]]), tape([[], [1]], [['network'], [1]])),
    ).toBeLessThan(0)
  })

  test('a tape with the same count of values is smaller with smaller values', () => {
    expect(compareTapes(tape([[], [1, 2]]), tape([[], [1, 3]]))).toBeLessThan(0)
    expect(compareTapes(tape([[], [1, 2]]), tape([[], [1, 2]]))).toBe(0)
  })
})
