import type { RandomSource } from './random-source'
import { deriveSeed, SeededRandom } from './random-source'

/**
 * A part of the input: the values that 1 method call or 1 `span` read.
 */
export interface RandomSpan {
  label: string
  start: number
  end: number
  depth: number
}

/**
 * The values of 1 random source. The path has the labels of the forks.
 */
export interface RandomTapeStream {
  path: string[]
  /**
   * The values without the zeros at the end.
   */
  values: number[]
  /**
   * The count of values that the run read, with the zeros at the end.
   */
  length?: number
}

export interface RandomTapeRecord extends RandomTapeStream {
  length: number
  spans: RandomSpan[]
}

export interface RandomTapeMismatch {
  /** The count of random values that the run read. */
  read: number
  /** The count of random values on the tape. */
  recorded: number
}

/**
 * A method call, or the value of `span` or `many`. The calls inside `span` and `many` are not
 * reported, because the value shows their result.
 */
export interface RandomCall {
  path: readonly string[]
  method: string
  args: readonly unknown[]
  result: unknown
  /**
   * The call read only zeros, so its result is the simplest one.
   */
  simplest: boolean
  /**
   * The count of random values that all sources of the tape read until the end of the call.
   */
  reads: number
  /**
   * The effect of the call in words, if the result alone does not show it.
   */
  description?: string
}

export interface RandomTapeOptions {
  /**
   * The values to read. Without them, the tape records the values of the seed.
   */
  streams?: readonly RandomTapeStream[]
  /**
   * What a source reads after the `length` of its stream: zeros, which give the simplest
   * results (to shrink), or the values of its seed (to replay a tape after a change of the code).
   * @default 'zeros'
   */
  afterEnd?: 'zeros' | 'seed'
  /**
   * The count of zeros that a run can read after the end of the tape.
   */
  maxExtraReads?: number
  /**
   * Without it, the tape keeps no values and no spans, and only counts the values and the calls.
   * @default true
   */
  record?: boolean
  onCall?: (call: RandomCall) => void
  /**
   * The count of calls that `onCall` receives. `callCount` counts all calls.
   */
  maxReportedCalls?: number
}

interface TapeState {
  readonly path: readonly string[]
  readonly values: number[]
  readonly length: number
  readonly spans: RandomSpan[]
  read: number
  depth: number
  calls: number
}

/**
 * The raw values of a run, for each fork. In replay mode, a source reads the values of the tape,
 * then zeros up to the `length` of its stream, and then zeros or the values of its seed.
 */
export class RandomTape {
  readonly replay: boolean
  readonly afterEnd: 'zeros' | 'seed'
  readonly record: boolean
  readonly onCall: ((call: RandomCall) => void) | undefined
  readonly maxReportedCalls: number
  // the open calls of `span` and `many` in all forks
  valueDepth = 0
  reads = 0
  nonZeroReads = 0
  /** The values that the run read outside of an outer `span` or `many`. */
  readsOutsideValues = 0
  callCount = 0
  private readonly states = new Map<string, TapeState>()
  private readonly maxExtraReads: number
  private extraReads = 0

  constructor(options: RandomTapeOptions = {}) {
    this.replay = options.streams != null
    this.afterEnd = options.afterEnd ?? 'zeros'
    this.record = options.record ?? true
    this.onCall = options.onCall
    this.maxReportedCalls = options.maxReportedCalls ?? Number.POSITIVE_INFINITY
    this.maxExtraReads = options.maxExtraReads ?? Number.POSITIVE_INFINITY
    for (const { path, values, length = values.length } of options.streams ?? []) {
      this.states.set(JSON.stringify(path), createTapeState(path, values.slice(), length))
    }
  }

  /**
   * Returns a random source that records its values on this tape, or reads them from it.
   */
  createSource(seed: string): RandomSource {
    return new TapeRandom(seed, this, [])
  }

  getState(path: readonly string[]): TapeState {
    const key = JSON.stringify(path)
    let state = this.states.get(key)
    if (!state) {
      state = createTapeState(path, [], 0)
      this.states.set(key, state)
    }
    return state
  }

  readPastEnd(): void {
    // code that waits for a value other than 0 would never end
    if (++this.extraReads > this.maxExtraReads) {
      throw new Error(
        `The test read more than ${this.maxExtraReads} random values after the end of the tape.`,
      )
    }
  }

  /**
   * In replay mode, the counts of values if a fork read another count of values than the tape
   * has: the code changed after the tape was recorded.
   */
  getMismatch(): RandomTapeMismatch | undefined {
    if (!this.replay) {
      return undefined
    }
    let read = 0
    let recorded = 0
    let fits = true
    for (const state of this.states.values()) {
      read += state.read
      recorded += state.length
      fits &&= state.read === state.length
    }
    return fits ? undefined : { read, recorded }
  }

  /**
   * The values that each fork read. The zeros at the end are only counted in `length`. A fork
   * that read only zeros has a record too, so that a replay gives it zeros and not the values
   * of its seed.
   */
  getRecords(): RandomTapeRecord[] {
    const records: RandomTapeRecord[] = []
    if (!this.record) {
      return records
    }
    const keys = [...this.states.keys()].sort()
    for (const key of keys) {
      const state = this.states.get(key)!
      if (!state.read) {
        continue
      }
      const values = state.values.slice(0, state.read)
      let end = values.length
      while (end > 0 && !values[end - 1]) {
        end--
      }
      values.length = end
      records.push({
        path: [...state.path],
        values,
        length: state.read,
        spans: state.spans.filter((span) => span.start < end),
      })
    }
    return records
  }
}

function createTapeState(path: readonly string[], values: number[], length: number): TapeState {
  return { path, values, length, spans: [], read: 0, depth: 0, calls: 0 }
}

/**
 * Calls `fn`, which reads values from `source`. If the source has a tape, the tape shows
 * 1 call with this method name, the arguments and the result, and not the calls inside `fn`.
 * `describe` runs only when the tape reports the call.
 */
export function recordRandomCall<T>(
  source: RandomSource,
  method: string,
  args: readonly unknown[],
  fn: () => T,
  describe?: (result: T) => string,
): T {
  return source instanceof TapeRandom ? source.call(method, args, fn, describe) : fn()
}

// the arguments without the `undefined` ones at the end (this is a micro benchmark optimisation)
function getArgs(a: unknown, b: unknown, c: unknown): unknown[] {
  return c !== undefined ? [a, b, c] : b !== undefined ? [a, b] : a !== undefined ? [a] : []
}

// It records the raw values that it reads, or it reads them from the tape. Each method call and
// each span is 1 part of the input.
class TapeRandom extends SeededRandom {
  // the methods of SeededRandom; they read raw values through the new `uint32`. A new method
  // must be added here, or it shows each raw value as 1 call.
  private readonly base: Omit<RandomSource, 'seed' | 'fork'>

  private readonly tape: RandomTape
  private readonly path: readonly string[]
  private readonly state: TapeState
  private index = 0

  constructor(seed: string, tape: RandomTape, path: readonly string[]) {
    super(seed)
    this.tape = tape
    this.path = path
    this.state = tape.getState(path)
    const base = {
      uint32: this.uint32,
      next: this.next,
      int: this.int,
      float: this.float,
      bool: this.bool,
      pick: this.pick,
      weighted: this.weighted,
      shuffle: this.shuffle,
      sample: this.sample,
      bytes: this.bytes,
      uuid: this.uuid,
      span: this.span,
      many: this.many,
    }
    this.base = base
    // a read inside another method is not a separate part, so it reads directly
    this.uint32 = () => (this.state.calls > 0 ? this.read() : this.callMethod('uint32', this.read))
    this.next = () => this.callMethod('next', base.next)
    this.int = (min, max, options) => this.callMethod('int', base.int, min, max, options)
    this.float = (min, max, options) => this.callMethod('float', base.float, min, max, options)
    this.bool = (probability) => this.callMethod('bool', base.bool, probability)
    this.pick = <T>(items: readonly T[]) => this.callMethod('pick', base.pick<T>, items)
    this.weighted = <T>(entries: readonly (readonly [value: T, weight: number])[]) =>
      this.callMethod('weighted', base.weighted<T>, entries)
    this.shuffle = <T>(items: readonly T[]) => this.callMethod('shuffle', base.shuffle<T>, items)
    this.sample = <T>(items: readonly T[], count: number) =>
      this.callMethod('sample', base.sample<T>, items, count)
    this.bytes = (length) => this.callMethod('bytes', base.bytes, length)
    this.uuid = () => this.callMethod('uuid', base.uuid)
    this.span = (label, fn) => this.callWithValue('span', [label], () => base.span(label, fn))
    this.many = (label, fn, options) =>
      this.callWithValue('many', options === undefined ? [label] : [label, options], () =>
        base.many(label, fn, options),
      )
  }

  private read = (): number => {
    const state = this.state
    const index = this.index++
    if (index >= state.read) {
      state.read = index + 1
    }
    const tape = this.tape
    let value = 0
    if (!tape.replay) {
      value = this.base.uint32()
    } else {
      // the generator moves on every read, so the values after the tape are the values that
      // the seed has at these places
      const seedValue = tape.afterEnd === 'seed' ? this.base.uint32() : 0
      if (index < state.values.length || index < state.length) {
        value = state.values[index] ?? 0
      } else if (tape.afterEnd === 'seed') {
        value = seedValue
      } else {
        tape.readPastEnd()
      }
    }
    if (tape.record) {
      state.values[index] = value
    }
    tape.reads++
    if (value) {
      tape.nonZeroReads++
    }
    if (!tape.valueDepth) {
      tape.readsOutsideValues++
    }
    return value
  }

  call<T>(
    method: string,
    args: readonly unknown[],
    run: () => T,
    describe?: (result: T) => string,
  ): T {
    return this.callMethod(method, run, undefined, undefined, undefined, args, describe)
  }

  // The calls inside a call, for example `int` inside `pick`, are not separate parts. `fn` gets
  // the arguments one by one, so that a call creates no array when nothing reports it.
  private callMethod<T>(
    method: string,
    fn: (a?: any, b?: any, c?: any) => T,
    a?: unknown,
    b?: unknown,
    c?: unknown,
    args?: readonly unknown[],
    describe?: (result: T) => string,
  ): T {
    const state = this.state
    if (state.calls > 0) {
      return fn(a, b, c)
    }
    const tape = this.tape
    const start = this.index
    const nonZeroReads = tape.nonZeroReads
    state.calls++
    state.depth++
    let result: T
    try {
      result = fn(a, b, c)
    } finally {
      state.calls--
      state.depth--
    }
    const end = this.index
    if (end > start && tape.record) {
      state.spans.push({ label: method, start, end, depth: state.depth })
    }
    if (!tape.valueDepth) {
      if (tape.onCall && tape.callCount < tape.maxReportedCalls) {
        this.report(method, args ?? getArgs(a, b, c), result, nonZeroReads, describe)
      } else {
        tape.callCount++
      }
    }
    return result
  }

  // the value of the outer `span` or `many` is reported instead of the calls inside it
  private callWithValue<T>(method: string, args: readonly unknown[], run: () => T): T {
    const tape = this.tape
    const nonZeroReads = tape.nonZeroReads
    tape.valueDepth++
    let result: T
    try {
      result = run()
    } finally {
      tape.valueDepth--
    }
    if (!tape.valueDepth) {
      this.report(method, args, result, nonZeroReads)
    }
    return result
  }

  private report<T>(
    method: string,
    args: readonly unknown[],
    result: T,
    nonZeroReads: number,
    describe?: (result: T) => string,
  ) {
    const tape = this.tape
    const index = tape.callCount++
    const onCall = tape.onCall
    if (!onCall || index >= tape.maxReportedCalls) {
      return
    }
    const call: RandomCall = {
      path: this.path,
      method,
      args,
      result,
      simplest: tape.nonZeroReads === nonZeroReads,
      reads: tape.reads,
    }
    if (describe) {
      call.description = describe(result)
    }
    onCall(call)
  }

  // the values that decide the length of `many` are not shown as calls
  protected override readMore(probability: number): boolean {
    this.state.calls++
    try {
      return this.base.bool(probability)
    } finally {
      this.state.calls--
    }
  }

  protected override withSpan<T>(label: string, fn: () => T): T {
    const state = this.state
    const start = this.index
    const depth = state.depth++
    try {
      return fn()
    } finally {
      state.depth--
      if (this.index > start && this.tape.record) {
        state.spans.push({ label, start, end: this.index, depth })
      }
    }
  }

  protected override createFork(label: string): SeededRandom {
    return new TapeRandom(deriveSeed(['fork', this.seed, label]), this.tape, [...this.path, label])
  }
}

const TAPE_VERSION = 1

let encoder: TextEncoder | undefined

export function encodeRandomTape(streams: readonly RandomTapeStream[]): string {
  const bytes: number[] = [TAPE_VERSION]
  writeVarint(bytes, streams.length)
  for (const { path, values, length = values.length } of streams) {
    writeVarint(bytes, path.length)
    for (const label of path) {
      const encoded = (encoder ??= new TextEncoder()).encode(label)
      writeVarint(bytes, encoded.length)
      bytes.push(...encoded)
    }
    writeVarint(bytes, length)
    writeVarint(bytes, values.length)
    for (const value of values) {
      writeVarint(bytes, value)
    }
  }
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// `null` if the text is not a valid tape
export function decodeRandomTape(text: string): RandomTapeStream[] | null {
  if (!/^[\w-]+$/.test(text)) {
    return null
  }
  let binary: string
  try {
    binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return null
  }
  let offset = 0
  // -1 if the text ends in the middle of the value, or the value has more than 5 bytes
  const readVarint = (): number => {
    let value = 0
    let factor = 1
    // a value of 32 bits has at most 5 bytes
    for (let i = 0; i < 5 && offset < binary.length; i++) {
      const byte = binary.charCodeAt(offset++)
      value += (byte & 0x7f) * factor
      if (byte < 0x80) {
        return value
      }
      factor *= 128
    }
    return -1
  }
  if (readVarint() !== TAPE_VERSION) {
    return null
  }
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const streams: RandomTapeStream[] = []
  const streamCount = readVarint()
  if (streamCount < 0) {
    return null
  }
  for (let i = 0; i < streamCount; i++) {
    const path: string[] = []
    const labelCount = readVarint()
    if (labelCount < 0) {
      return null
    }
    for (let j = 0; j < labelCount; j++) {
      const length = readVarint()
      if (length < 0 || offset + length > binary.length) {
        return null
      }
      const bytes = Uint8Array.from(binary.slice(offset, offset + length), (char) =>
        char.charCodeAt(0),
      )
      offset += length
      try {
        path.push(decoder.decode(bytes))
      } catch {
        return null
      }
    }
    const length = readVarint()
    const valueCount = readVarint()
    if (length < 0 || valueCount < 0 || valueCount > length) {
      return null
    }
    const values: number[] = []
    for (let j = 0; j < valueCount; j++) {
      const value = readVarint()
      if (value < 0 || value > 0xffff_ffff) {
        return null
      }
      values.push(value)
    }
    streams.push({ path, values, length })
  }
  return offset === binary.length ? streams : null
}

// 7 bits in each byte; the high bit marks that more bytes follow
function writeVarint(bytes: number[], value: number): void {
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80)
    value = Math.floor(value / 128)
  }
  bytes.push(value)
}
