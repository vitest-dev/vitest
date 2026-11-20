import type { RandomTapeRecord, RandomTapeStream } from '@vitest/utils/random-tape'
import { deriveSeed } from '@vitest/utils/random-source'

export interface ShrinkOptions {
  /**
   * The time when shrinking stops, in the time of `now`.
   */
  deadline: number
  now: () => number
  maxRuns?: number
  /**
   * Shrinking stops after this count of runs without a smaller input.
   */
  maxStalledRuns?: number
  shouldStop?: () => boolean
  onProgress?: (progress: { runs: number; values: number }) => void
}

export interface ShrinkRun {
  /** The values that the run read. */
  records: RandomTapeRecord[]
  /** The run failed in the same way. */
  same: boolean
  /** The run took too long, so it was stopped. */
  slow?: boolean
}

export interface ShrinkResult {
  records: RandomTapeRecord[]
  runs: number
  shrunk: boolean
  /**
   * Shrinking stopped at the deadline, so a smaller input can exist.
   */
  timedOut: boolean
}

const BLOCK_SIZES = [8, 4, 2, 1]
// most of the runs at the end only show that no smaller input fails
const MAX_STALLED_RUNS = 200

/**
 * Changes the values of a failed run and keeps each change that fails in the same way with a
 * smaller input.
 */
export async function shrinkTape(
  initial: RandomTapeRecord[],
  run: (streams: RandomTapeStream[]) => Promise<ShrinkRun>,
  options: ShrinkOptions,
): Promise<ShrinkResult> {
  const maxRuns = options.maxRuns ?? Number.POSITIVE_INFINITY
  const maxStalledRuns = options.maxStalledRuns ?? MAX_STALLED_RUNS
  let best = initial
  let runs = 0
  let runsAtLastShrink = 0
  let shrunk = false
  let stopped = false
  let timedOut = false
  const tried = new Set([getKey(initial)])
  const slowRuns: RandomTapeRecord[][] = []

  const isStopped = () => {
    if (!stopped && options.now() >= options.deadline) {
      timedOut = true
    }
    return (stopped ||=
      timedOut ||
      runs >= maxRuns ||
      runs - runsAtLastShrink >= maxStalledRuns ||
      !!options.shouldStop?.())
  }

  const tryValues = async (path: string[], values: number[]): Promise<boolean> => {
    if (isStopped()) {
      return false
    }
    const candidate = normalize(
      best.map((stream) => (isPath(stream, path) ? { path, values } : stream)),
    )
    const key = getKey(candidate)
    // the test does the same with the same values, so it would be slow again
    if (tried.has(key) || slowRuns.some((records) => readsSameValues(candidate, records))) {
      return false
    }
    tried.add(key)
    runs++
    const result = await run(candidate)
    const smaller = result.same && compareTapes(result.records, best) < 0
    if (smaller) {
      best = result.records
      shrunk = true
      runsAtLastShrink = runs
      tried.add(getKey(result.records))
    } else if (result.slow) {
      slowRuns.push(result.records)
    }
    options.onProgress?.({ runs, values: countValues(best) })
    return smaller
  }

  const getStream = (path: string[]): RandomTapeRecord | undefined =>
    best.find((stream) => isPath(stream, path))

  const getValues = (path: string[]): number[] | undefined => getStream(path)?.values

  // each pass goes through the current input again after a change
  const passes: ((path: string[]) => Promise<boolean>)[] = [
    // the whole fork reads zeros
    (path) => tryValues(path, []),
    removeParts,
    // replace a part with a smaller part of the same kind inside it, for example a subtree
    (path) =>
      forEachChange(path, (stream, i) => {
        const pair = getNestedPairs(stream)[i]
        return (
          pair &&
          splice(
            stream.values,
            pair.outer.start,
            pair.outer.end,
            stream.values.slice(pair.inner.start, pair.inner.end),
          )
        )
      }),
    // remove values without a part, starting at the end
    (path) => forEachBlock(path, (values, start, end) => splice(values, start, end, [])),
    // set a part to zeros
    (path) =>
      forEachChange(path, (stream, i) => {
        const span = getNonZeroSpans(stream)[i]
        return span && splice(stream.values, span.start, span.end, zeros(size(span)))
      }),
    // set values to zeros, starting at the end
    (path) =>
      forEachBlock(path, (values, start, end) =>
        values.slice(start, end).some(Boolean)
          ? splice(values, start, end, zeros(end - start))
          : undefined,
      ),
    // make each value as small as possible
    minimizeValues,
  ]

  // removes 1 part, and then the parts that follow it at the same level, for example the next
  // items of `many`
  async function removeParts(path: string[]): Promise<boolean> {
    let improved = false
    let index = 0
    while (!isStopped()) {
      const stream = getStream(path)
      const part = stream && getSpansBySize(stream)[index]
      if (!part) {
        break
      }
      if (await tryValues(path, splice(stream.values, part.start, part.end, []))) {
        improved = true
        const ends = getNextPartEnds(stream, part)
        // remove the part and the next `count` parts from the input before the removal
        await findInteger(
          (count) =>
            count <= ends.length &&
            tryValues(path, splice(stream.values, part.start, ends[count - 1], [])),
        )
      } else {
        index++
      }
    }
    return improved
  }

  async function forEachChange(
    path: string[],
    change: (stream: RandomTapeRecord, index: number) => number[] | undefined,
  ): Promise<boolean> {
    let improved = false
    let index = 0
    while (!isStopped()) {
      const stream = getStream(path)
      const values = stream && change(stream, index)
      if (!values) {
        break
      }
      // after a change, the next candidate has the same index in the new input
      if (await tryValues(path, values)) {
        improved = true
      } else {
        index++
      }
    }
    return improved
  }

  async function forEachBlock(
    path: string[],
    change: (values: number[], start: number, end: number) => number[] | undefined,
  ): Promise<boolean> {
    let improved = false
    for (const size of BLOCK_SIZES) {
      let start = (getValues(path)?.length ?? 0) - size
      while (start >= 0 && !isStopped()) {
        const values = getValues(path)
        if (!values) {
          return improved
        }
        start = Math.min(start, values.length - size)
        const candidate = start >= 0 ? change(values, start, start + size) : undefined
        if (candidate && (await tryValues(path, candidate))) {
          improved = true
        }
        start--
      }
    }
    return improved
  }

  async function minimizeValues(path: string[]): Promise<boolean> {
    const start = best
    for (let index = 0; !isStopped(); index++) {
      const values = getValues(path)
      if (!values || index >= values.length) {
        break
      }
      if (values[index]) {
        await simplifyValue(path, index)
        await searchValue(path, index)
      }
    }
    return best !== start
  }

  // Code that reads only some bits or bytes of a value, for example `byte % 36`, can fail for a
  // smaller value that `searchValue` skips. The steps come from the integer shrinker of
  // Hypothesis, plus the byte shifts for `random.bytes()`.
  async function simplifyValue(path: string[], index: number): Promise<void> {
    const getValue = () => getValues(path)?.[index] ?? 0
    // true if the value is this value now
    const tryValue = async (value: number): Promise<boolean> => {
      const values = getValues(path)
      if (!values || index >= values.length || value > values[index]) {
        return false
      }
      if (value === values[index]) {
        return true
      }
      const candidate = values.slice()
      candidate[index] = value
      return tryValues(path, candidate)
    }
    if ((await tryValue(0)) || (await tryValue(1))) {
      return
    }
    // clear the high bits
    let base = getValue()
    let bits = 32 - Math.clz32(base)
    await findInteger((count) => count < bits && tryValue(base & (2 ** (bits - count) - 1)))
    // keep 1 or 2 bytes
    for (const shift of [24, 16, 8]) {
      await tryValue(getValue() >>> shift)
    }
    await tryValue(getValue() & 0xff)
    await tryValue(getValue() & 0xffff)
    // shift right
    base = getValue()
    bits = 32 - Math.clz32(base)
    await findInteger((count) => count <= bits && tryValue(base >>> count))
  }

  // the values are monotone: a smaller raw value gives a simpler result
  async function searchValue(path: string[], index: number): Promise<void> {
    let high = getValues(path)?.[index] ?? 0
    let low = -1
    while (low + 1 < high && !isStopped()) {
      const middle = low === -1 ? 0 : low + Math.floor((high - low) / 2)
      const current = getValues(path)
      if (current?.[index] !== high) {
        break
      }
      const candidate = current.slice()
      candidate[index] = middle
      if (await tryValues(path, candidate)) {
        high = middle
      } else {
        low = middle
      }
    }
  }

  let improved = true
  while (improved && !isStopped()) {
    improved = false
    for (const pass of passes) {
      for (const path of best.map((stream) => stream.path)) {
        if (await pass(path)) {
          improved = true
        }
      }
    }
  }
  return { records: best, runs, shrunk, timedOut }
}

/**
 * Shortlex order: fewer values first, then smaller values.
 */
export function compareTapes(a: RandomTapeStream[], b: RandomTapeStream[]): number {
  const sizeDifference = countValues(a) - countValues(b)
  if (sizeDifference) {
    return sizeDifference
  }
  const keys = [...new Set([...a, ...b].map((stream) => JSON.stringify(stream.path)))].sort()
  for (const key of keys) {
    const valuesA = a.find((stream) => JSON.stringify(stream.path) === key)?.values ?? []
    const valuesB = b.find((stream) => JSON.stringify(stream.path) === key)?.values ?? []
    if (valuesA.length !== valuesB.length) {
      return valuesA.length - valuesB.length
    }
    for (let i = 0; i < valuesA.length; i++) {
      if (valuesA[i] !== valuesB[i]) {
        return valuesA[i] - valuesB[i]
      }
    }
  }
  return 0
}

// The largest `n` for which `test(n)` is true, if `test` is true for each count up to `n`.
// It tries 1 to 4 first, because most results are small. Then it doubles `n` and
// does a binary search. `test(0)` is not called.
async function findInteger(test: (n: number) => Promise<boolean> | boolean): Promise<number> {
  for (let n = 1; n < 5; n++) {
    if (!(await test(n))) {
      return n - 1
    }
  }
  let low = 4
  let high = 5
  while (await test(high)) {
    low = high
    high *= 2
  }
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (await test(middle)) {
      low = middle
    } else {
      high = middle
    }
  }
  return low
}

export function countValues(streams: RandomTapeStream[]): number {
  return streams.reduce((sum, stream) => sum + stream.values.length, 0)
}

// the end of a tape gives zeros, so zeros at the end are left out
function normalize(streams: RandomTapeStream[]): RandomTapeStream[] {
  return streams.flatMap(({ path, values }) => {
    let length = values.length
    while (length > 0 && !values[length - 1]) {
      length--
    }
    return length ? [{ path, values: values.slice(0, length) }] : []
  })
}

// a hash keeps the memory small, because an input can have many values
function getKey(streams: RandomTapeStream[]): string {
  const parts: string[] = []
  for (const { path, values } of streams) {
    let length = values.length
    while (length > 0 && !values[length - 1]) {
      length--
    }
    if (length) {
      parts.push(JSON.stringify(path), valuesText(values, length))
    }
  }
  return deriveSeed(parts)
}

// Each value is 2 UTF-16 code units: `fromCharCode` keeps the lower 16 bits of each argument.
// 4 values in each call are faster than JSON and than 1 value in each call.
function valuesText(values: number[], length: number): string {
  let text = ''
  let i = 0
  for (; i + 4 <= length; i += 4) {
    const a = values[i]
    const b = values[i + 1]
    const c = values[i + 2]
    const d = values[i + 3]
    text += String.fromCharCode(a, a >>> 16, b, b >>> 16, c, c >>> 16, d, d >>> 16)
  }
  for (; i < length; i++) {
    text += String.fromCharCode(values[i], values[i] >>> 16)
  }
  return text
}

// the candidate has the values that the run read, and zeros after its end are values too
function readsSameValues(candidate: RandomTapeStream[], records: RandomTapeRecord[]): boolean {
  return records.every(({ path, values, length }) => {
    const candidateValues = candidate.find((stream) => isPath(stream, path))?.values ?? []
    for (let i = 0; i < length; i++) {
      if ((candidateValues[i] ?? 0) !== (values[i] ?? 0)) {
        return false
      }
    }
    return true
  })
}

function isPath(stream: RandomTapeStream, path: readonly string[]): boolean {
  return stream.path.length === path.length && stream.path.every((label, i) => label === path[i])
}

interface Range {
  start: number
  end: number
}

interface Part extends Range {
  depth: number
}

const spansBySize = new WeakMap<RandomTapeRecord, Part[]>()
const nestedPairs = new WeakMap<RandomTapeRecord, { outer: Range; inner: Range }[]>()

// the largest parts first, each range 1 time with its outer level
function getSpansBySize(stream: RandomTapeRecord): Part[] {
  let result = spansBySize.get(stream)
  if (!result) {
    const parts = new Map<string, Part>()
    for (const { start, end, depth } of stream.spans) {
      const clampedEnd = Math.min(end, stream.values.length)
      const key = `${start}:${clampedEnd}`
      const existing = parts.get(key)
      if (clampedEnd > start && (!existing || depth < existing.depth)) {
        parts.set(key, { start, end: clampedEnd, depth })
      }
    }
    result = [...parts.values()].sort((a, b) => size(b) - size(a) || a.start - b.start)
    spansBySize.set(stream, result)
  }
  return result
}

// the ends of the parts that directly follow `part` at the same level
function getNextPartEnds(stream: RandomTapeRecord, part: Part): number[] {
  const endsByStart = new Map<number, number>()
  for (const { start, end, depth } of stream.spans) {
    if (depth === part.depth && start >= part.end) {
      endsByStart.set(start, Math.min(end, stream.values.length))
    }
  }
  const ends: number[] = []
  let end = endsByStart.get(part.end)
  while (end !== undefined && end > (ends.at(-1) ?? part.end)) {
    ends.push(end)
    end = endsByStart.get(end)
  }
  return ends
}

// a part and a smaller part with the same label inside it, the largest difference first
function getNestedPairs(stream: RandomTapeRecord): { outer: Range; inner: Range }[] {
  let pairs = nestedPairs.get(stream)
  if (!pairs) {
    pairs = []
    const spans = stream.spans
      .filter((span) => span.start < stream.values.length)
      .sort((a, b) => a.start - b.start || size(b) - size(a))
    for (let i = 0; i < spans.length; i++) {
      const outer = spans[i]
      for (let j = i + 1; j < spans.length && spans[j].start < outer.end; j++) {
        const inner = spans[j]
        if (
          inner.label === outer.label &&
          inner.depth > outer.depth &&
          inner.end <= outer.end &&
          size(inner) < size(outer)
        ) {
          pairs.push({ outer, inner })
        }
      }
    }
    pairs.sort(
      (a, b) =>
        size(b.outer) - size(b.inner) - (size(a.outer) - size(a.inner)) ||
        a.outer.start - b.outer.start,
    )
    nestedPairs.set(stream, pairs)
  }
  return pairs
}

const nonZeroSpans = new WeakMap<RandomTapeRecord, Range[]>()

function getNonZeroSpans(stream: RandomTapeRecord): Range[] {
  let result = nonZeroSpans.get(stream)
  if (!result) {
    result = getSpansBySize(stream).filter((span) =>
      stream.values.slice(span.start, span.end).some(Boolean),
    )
    nonZeroSpans.set(stream, result)
  }
  return result
}

function size(range: Range): number {
  return range.end - range.start
}

function splice(values: number[], start: number, end: number, items: number[]): number[] {
  return [...values.slice(0, start), ...items, ...values.slice(end)]
}

function zeros(length: number): number[] {
  return Array.from({ length }, () => 0)
}
