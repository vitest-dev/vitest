import type { RandomSource } from '@vitest/utils/random-source'
import type { RandomCall } from '@vitest/utils/random-tape'
import { createRandomSource } from '@vitest/utils/random-source'
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

  test('reports the calls, the value of a span instead of the calls inside it, and the count of values read', () => {
    const calls: RandomCall[] = []
    const tape = new RandomTape({
      streams: [{ path: [], values: [0, 2 ** 31, 2 ** 31] }],
      onCall: (call) => calls.push(call),
    })
    const random = tape.createSource(RUN_SEED)
    random.span('user', () => ({ age: random.int(18, 99), admin: random.bool() }))
    random.pick(['leader', 'follower'])
    random.int(-5, 5, { uniform: true })
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
        args: [-5, 5, { uniform: true }],
        result: 0,
        simplest: true,
        reads: 4,
      },
      { path: ['network'], method: 'bool', args: [], result: false, simplest: true, reads: 5 },
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

  test('getMismatch() reports a replay that reads another count of values than the tape has', () => {
    const streams = [{ path: [], values: [7, 0, 3], length: 4 }]
    const replay = (read: (random: RandomSource) => void) => {
      const tape = new RandomTape({ streams, afterEnd: 'seed' })
      read(tape.createSource(RUN_SEED))
      return tape.getMismatch()
    }
    expect(replay((random) => Array.from({ length: 4 }, () => random.uint32()))).toBeUndefined()
    expect(replay((random) => random.uint32())).toEqual({ read: 1, recorded: 4 })
    expect(replay((random) => Array.from({ length: 6 }, () => random.uint32()))).toEqual({
      read: 6,
      recorded: 4,
    })
    // a fork that is not on the tape
    expect(
      replay((random) => {
        Array.from({ length: 4 }, () => random.uint32())
        random.fork('network').uint32()
      }),
    ).toEqual({ read: 5, recorded: 4 })
    // a recorded tape has nothing to compare
    const recorded = new RandomTape()
    recorded.createSource(RUN_SEED).uint32()
    expect(recorded.getMismatch()).toBeUndefined()
  })

  test('encodeRandomTape() and decodeRandomTape() keep the values', () => {
    const streams = [
      { path: [], values: [0, 1, 127, 128, 2 ** 32 - 1], length: 7 },
      { path: ['vitest:globals', 'vitest:timers'], values: [5], length: 1 },
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
  })
})
