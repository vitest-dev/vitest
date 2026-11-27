import type { RandomSource } from '@vitest/utils/random-source'
import type { RandomCall } from '@vitest/utils/random-tape'
import { createRandomSource, getRandomStates, trackRandomStates } from '@vitest/utils/random-source'
import {
  decodeRandomTape,
  encodeRandomTape,
  RandomTape,
  recordRandomCall,
} from '@vitest/utils/random-tape'
import { describe, expect, test } from 'vitest'

const RUN_SEED = '0000000000000000'

describe('RandomTape', () => {
  test('a recording source returns the values of the seed', () => {
    const tape = new RandomTape()
    const random = tape.createSource(RUN_SEED)
    const plain = createRandomSource(RUN_SEED)
    const values = (source: typeof random) => [
      source.uuid(),
      source.int(0, 9),
      source.next(),
      source.fork('network').uint32(),
    ]
    expect(values(random)).toEqual(values(plain))
    expect(tape.getRecords().map(({ path, values }) => [path, values.length])).toEqual([
      [['network'], 1],
      [[], 7],
    ])
  })

  test('a replaying source reads the tape and then zeros', () => {
    const tape = new RandomTape({
      streams: [
        { path: [], values: [2 ** 31, 2 ** 31] },
        { path: ['network'], values: [2 ** 32 - 1] },
      ],
    })
    const random = tape.createSource(RUN_SEED)
    expect(random.bool()).toBe(true)
    expect(random.int(5, 10)).toBe(8)
    expect(random.int(5, 10)).toBe(5)
    expect(random.fork('network').pick(['leader', 'follower'])).toBe('follower')
    expect(random.fork('faults').pick(['leader', 'follower'])).toBe('leader')
  })

  test('the records keep the values that were read, and count the zeros at the end', () => {
    const tape = new RandomTape({ streams: [{ path: [], values: [7, 0, 9, 0, 0, 4] }] })
    const random = tape.createSource(RUN_SEED)
    random.uint32()
    random.uint32()
    random.uint32()
    random.uint32()
    random.fork('network').uint32()
    // a fork that read only zeros has a record, so that a replay gives it zeros again
    expect(tape.getRecords()).toEqual([
      { path: ['network'], values: [], length: 1, spans: expect.any(Array) },
      { path: [], values: [7, 0, 9], length: 4, spans: expect.any(Array) },
    ])
  })

  test('a replay reads the values of the seed after the length of the tape', () => {
    const tape = new RandomTape({
      streams: [{ path: [], values: [7], length: 3 }],
      afterEnd: 'seed',
    })
    const random = tape.createSource(RUN_SEED)
    const plain = createRandomSource(RUN_SEED)
    const seedValues = Array.from({ length: 5 }, () => plain.uint32())
    expect(Array.from({ length: 5 }, () => random.uint32())).toEqual([
      7,
      0,
      0,
      seedValues[3],
      seedValues[4],
    ])
    // a fork that is not on the tape reads the values of its own seed
    expect(random.fork('network').uint32()).toBe(plain.fork('network').uint32())
    const root = tape.getRecords().find((record) => record.path.length === 0)
    expect(root?.values).toEqual([7, 0, 0, seedValues[3], seedValues[4]])
  })

  test('each call and each span is 1 part', () => {
    const tape = new RandomTape()
    const random = tape.createSource(RUN_SEED)
    random.span('user', () => [random.pick(['leader', 'follower']), random.next()])
    random.many('ids', () => random.uuid(), { min: 1, max: 1 })
    expect(tape.getRecords()[0].spans).toMatchInlineSnapshot(`
      [
        {
          "depth": 1,
          "end": 1,
          "label": "pick",
          "start": 0,
        },
        {
          "depth": 1,
          "end": 3,
          "label": "next",
          "start": 1,
        },
        {
          "depth": 0,
          "end": 3,
          "label": "user",
          "start": 0,
        },
        {
          "depth": 2,
          "end": 8,
          "label": "uuid",
          "start": 4,
        },
        {
          "depth": 1,
          "end": 8,
          "label": "item",
          "start": 3,
        },
        {
          "depth": 0,
          "end": 8,
          "label": "ids",
          "start": 3,
        },
      ]
    `)
  })

  test('a span links the values that it read from other forks', () => {
    const tape = new RandomTape()
    const random = tape.createSource(RUN_SEED)
    const keys = random.fork('keys')
    random.many('ops', () => ({ kind: random.pick(['put', 'del']), key: keys.int(0, 9) }), {
      min: 2,
      max: 2,
    })
    // a span that reads only from a fork is a part too
    random.span('owner', () => keys.int(0, 9))
    const root = tape.getRecords().find((record) => record.path.length === 0)
    expect(root?.spans.filter((span) => span.links)).toMatchInlineSnapshot(`
      [
        {
          "depth": 1,
          "end": 2,
          "label": "item",
          "links": [
            {
              "end": 1,
              "path": [
                "keys",
              ],
              "start": 0,
            },
          ],
          "start": 0,
        },
        {
          "depth": 1,
          "end": 4,
          "label": "item",
          "links": [
            {
              "end": 2,
              "path": [
                "keys",
              ],
              "start": 1,
            },
          ],
          "start": 2,
        },
        {
          "depth": 0,
          "end": 4,
          "label": "ops",
          "links": [
            {
              "end": 2,
              "path": [
                "keys",
              ],
              "start": 0,
            },
          ],
          "start": 0,
        },
        {
          "depth": 0,
          "end": 4,
          "label": "owner",
          "links": [
            {
              "end": 3,
              "path": [
                "keys",
              ],
              "start": 2,
            },
          ],
          "start": 4,
        },
      ]
    `)
  })

  test('reports the calls, the value of a span instead of the calls inside it, and the count of values read', () => {
    const calls: RandomCall[] = []
    const tape = new RandomTape({
      streams: [{ path: [], values: [0, 2 ** 31, 2 ** 31] }],
      onCall: (call) => calls.push(call),
    })
    const random = tape.createSource(RUN_SEED)
    random.span('user', () => ({ age: random.int(18, 99), admin: random.bool() }))
    random.pick(['leader', 'follower'])
    random.int(-5, 5, { edgeCases: true })
    random.fork('network').bool()
    expect(
      calls.map(({ path, method, args, result, simplest, reads }) => ({
        path,
        method,
        args,
        result,
        simplest,
        reads,
      })),
    ).toEqual([
      {
        path: [],
        method: 'span',
        args: ['user'],
        result: { age: 18, admin: true },
        simplest: false,
        reads: 2,
      },
      {
        path: [],
        method: 'pick',
        args: [['leader', 'follower']],
        result: 'follower',
        simplest: false,
        reads: 3,
      },
      {
        path: [],
        method: 'int',
        args: [-5, 5, { edgeCases: true }],
        result: 0,
        simplest: true,
        reads: 5,
      },
      { path: ['network'], method: 'bool', args: [], result: false, simplest: true, reads: 6 },
    ])
  })

  test('recordRandomCall reports 1 call, and describes it only for a report', () => {
    const roll = (random: RandomSource) =>
      recordRandomCall(
        random,
        'rollDice',
        [2],
        () => random.int(1, 6) + random.int(1, 6),
        (sum) => `rollDice(2) gives ${sum}`,
      )
    const calls: RandomCall[] = []
    const tape = new RandomTape({ onCall: (call) => calls.push(call) })
    const sum = roll(tape.createSource(RUN_SEED))
    expect(calls).toEqual([
      {
        path: [],
        method: 'rollDice',
        args: [2],
        result: sum,
        simplest: false,
        reads: 2,
        description: `rollDice(2) gives ${sum}`,
      },
    ])
    // the same values without a tape, and no description without a report
    expect(roll(createRandomSource(RUN_SEED))).toBe(sum)
    let described = false
    recordRandomCall(
      new RandomTape().createSource(RUN_SEED),
      'rollDice',
      [],
      () => 1,
      () => {
        described = true
        return ''
      },
    )
    expect(described).toBe(false)
  })

  test('recordRandomCall reports 1 call also if the function reads another fork', () => {
    const calls: RandomCall[] = []
    const tape = new RandomTape({ onCall: (call) => calls.push(call) })
    const random = tape.createSource(RUN_SEED)
    const network = random.fork('network')
    recordRandomCall(random, 'send', [], () => network.int(0, 9))
    expect(calls.map(({ path, method }) => ({ path, method }))).toEqual([
      { path: [], method: 'send' },
    ])
  })

  test('a tape has 1 source, because each path has 1 stream', () => {
    const tape = new RandomTape()
    tape.createSource(RUN_SEED)
    expect(() => tape.createSource('0123456789abcdef')).toThrowErrorMatchingInlineSnapshot(
      `[Error: A random tape can have only 1 source.]`,
    )
  })

  test('a call with 1 possible result reads its values, and the tape records 0 for them', () => {
    const calls = (random: RandomSource) => [
      random.int(7, 7),
      random.int(7, 7, { edgeCases: true }),
      random.bool(0),
      random.bool(1),
      random.pick(['only']),
      random.weighted([
        ['drop', 0],
        ['deliver', 2],
      ]),
      random.many('items', (index) => index, { min: 2, max: 2 }),
      random.sample(['leader', 'follower'], 2).length,
    ]
    const tape = new RandomTape()
    const random = tape.createSource(RUN_SEED)
    const plain = createRandomSource(RUN_SEED)
    expect(calls(random)).toEqual([7, 7, false, true, 'only', 'deliver', [0, 1], 2])
    calls(plain)
    // the values of the seed after these calls are the same as without a tape
    expect(random.uint32()).toBe(plain.uint32())
    const [record] = tape.getRecords()
    expect(record.length).toBe(13)
    // the 1 value of `sample` before the last item
    expect(record.values.slice(0, 12).filter((value) => value !== 0)).toHaveLength(1)
  })

  test('a tape without "record" keeps no values, and "maxReportedCalls" limits the reports, not the count', () => {
    const calls: string[] = []
    const tape = new RandomTape({
      record: false,
      maxReportedCalls: 2,
      onCall: ({ method, reads }) => calls.push(`${method} ${reads}`),
    })
    const random = tape.createSource(RUN_SEED)
    const plain = createRandomSource(RUN_SEED)
    const values = (source: RandomSource) => [
      source.int(1, 6),
      source.span('user', () => [source.bool(), source.uuid()]),
      source.pick(['a', 'b']),
    ]
    expect(values(random)).toEqual(values(plain))
    expect(calls).toEqual(['int 1', 'span 6'])
    expect(tape.callCount).toBe(3)
    expect(tape.reads).toBe(7)
    expect(tape.getRecords()).toEqual([])
  })

  test('a source on a tape has the same random states as a plain source after the same calls', () => {
    function states(random: RandomSource) {
      trackRandomStates(random)
      const network = random.fork('network')
      random.int(0, 100)
      network.pick(['eu', 'us'])
      random.span('user', () => random.bool())
      return getRandomStates(random)
    }
    const plain = states(createRandomSource(RUN_SEED))
    expect(states(new RandomTape().createSource(RUN_SEED))).toEqual(plain)
    expect(states(new RandomTape({ record: false }).createSource(RUN_SEED))).toEqual(plain)
    // a replay of a kept tape also reads the values of its seed
    const kept = new RandomTape({ streams: [{ path: [], values: [7, 8] }], afterEnd: 'seed' })
    expect(states(kept.createSource(RUN_SEED))).toEqual(plain)
  })

  test('stops code that reads too many values after the end', () => {
    const tape = new RandomTape({ streams: [], maxExtraReads: 100 })
    const random = tape.createSource(RUN_SEED)
    expect(() => {
      while (!random.bool()) {
        // waits for a value that the tape never gives
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: The test read more than 100 random values after the end of the tape.]`,
    )
  })

  test('getMismatch() reports each fork that reads another count of values than the tape has', () => {
    const streams = [
      { path: [], values: [7, 0, 3], length: 4 },
      { path: ['alice'], values: [5], length: 2 },
    ]
    const replay = (read: (random: RandomSource) => void, maxForks = 3) => {
      const tape = new RandomTape({ streams, afterEnd: 'seed' })
      read(tape.createSource(RUN_SEED))
      return tape.getMismatch(maxForks)
    }
    const readValues = (random: RandomSource, count: number) =>
      Array.from({ length: count }, () => random.uint32())
    expect(
      replay((random) => {
        readValues(random, 4)
        readValues(random.fork('alice'), 2)
      }),
    ).toBeUndefined()
    expect(replay((random) => random.uint32())).toEqual({
      forks: [
        { path: [], read: 1, recorded: 4 },
        { path: ['alice'], read: 0, recorded: 2 },
      ],
      count: 2,
    })
    expect(
      replay((random) => {
        readValues(random, 6)
        readValues(random.fork('alice'), 2)
      }),
    ).toEqual({ forks: [{ path: [], read: 6, recorded: 4 }], count: 1 })
    // the fork 'alice' is renamed to 'sender'
    expect(
      replay((random) => {
        readValues(random, 4)
        readValues(random.fork('sender'), 2)
      }),
    ).toEqual({
      forks: [
        { path: ['alice'], read: 0, recorded: 2 },
        { path: ['sender'], read: 2, recorded: 0 },
      ],
      count: 2,
    })
    // the other forks are only counted
    expect(
      replay((random) => {
        for (const label of ['sender', 'bank', 'broker']) {
          random.fork(label).uint32()
        }
      }, 2),
    ).toEqual({
      forks: [
        { path: [], read: 0, recorded: 4 },
        { path: ['alice'], read: 0, recorded: 2 },
      ],
      count: 5,
    })
    // a recorded tape has nothing to compare
    const recorded = new RandomTape()
    recorded.createSource(RUN_SEED).uint32()
    expect(recorded.getMismatch(3)).toBeUndefined()
  })

  test('encodeRandomTape() and decodeRandomTape() keep the values', () => {
    const streams = [
      { path: [], values: [0, 1, 127, 128, 2 ** 32 - 1], length: 7 },
      { path: ['vitest:globals', 'vitest:clock'], values: [5], length: 1 },
      { path: ['ünïcode'], values: [], length: 16 },
    ]
    const text = encodeRandomTape(streams)
    expect(text).toMatch(/^[\w-]+$/)
    expect(decodeRandomTape(text)).toEqual(streams)
  })

  test('decodeRandomTape() returns null for text that is not a tape', () => {
    expect(decodeRandomTape('not a tape')).toBeNull()
    // the bytes 2 and 0: an unknown version
    expect(decodeRandomTape('AgA')).toBeNull()
    // a tape that ends in the middle of a value
    const text = encodeRandomTape([{ path: [], values: [2 ** 32 - 1] }])
    expect(decodeRandomTape(text.slice(0, -2))).toBeNull()
    // the bytes 1, 0 and 0: version 1, 0 streams, and 1 more byte
    expect(encodeRandomTape([])).toBe('AQA')
    expect(decodeRandomTape('AQA')).toEqual([])
    expect(decodeRandomTape('AQAA')).toBeNull()
    // each number of a tape has at most 32 bits, also the count of values that a fork read
    const length = (count: number) =>
      decodeRandomTape(encodeRandomTape([{ path: [], values: [], length: count }]))
    expect(length(2 ** 32 - 1)).toEqual([{ path: [], values: [], length: 2 ** 32 - 1 }])
    expect(length(2 ** 32)).toBeNull()
    expect(length(2 ** 35 - 1)).toBeNull()
  })
})
