import type {
  RandomSpan,
  RandomSpanLink,
  RandomTapeRecord,
  RandomTapeStream,
} from '@vitest/utils/random-tape'
import { createRandomSource, deriveSeed } from '@vitest/utils/random-source'

export interface ShrinkOptions {
  /**
   * The time when shrinking stops, in the time of `now`.
   */
  deadline: number
  now: () => number
  maxRuns?: number
  /**
   * Shrinking stops after this count of runs in a row without a smaller input. The count grows
   * during the search, so that each loop through the passes can end.
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
const MAX_FAILED_STEPS = 20

// A pass makes 1 kind of change. Each step changes 1 place of a fork, and can make many runs.
interface Pass {
  count: (stream: RandomTapeRecord) => number
  step: (stream: RandomTapeRecord, index: number) => Promise<unknown>
}

interface PassState {
  pass: Pass
  input: RandomTapeRecord[] | undefined
  // the steps of each fork in the input
  counts: number[]
  total: number
  done: Set<number>
  // the last step, where the next turn of the pass starts
  position: number
  rank: number
}

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
  let maxStalledRuns = options.maxStalledRuns ?? MAX_STALLED_RUNS
  let best = withZeros(initial)
  let runs = 0
  let runsAtLastShrink = 0
  let shrunk = false
  let stopped = false
  let timedOut = false
  const initialKey = getKey(best)
  const tried = new Set([initialKey])
  const slowRuns: RandomTapeRecord[][] = []
  const random = createRandomSource(initialKey)

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

  const tryChanges = async (changes: Change[]): Promise<boolean> => {
    if (isStopped()) {
      return false
    }
    const candidate = best.map((stream) => ({
      path: stream.path,
      values: changes.find((change) => isPath(stream, change.path))?.values ?? stream.values,
    }))
    const key = getKey(candidate)
    // the test does the same with the same values, so it would be slow again
    if (tried.has(key) || slowRuns.some((records) => readsSameValues(candidate, records))) {
      return false
    }
    tried.add(key)
    runs++
    const result = await run(candidate)
    const records = withZeros(result.records)
    // a run that reads more values than the input has is not a run of this input
    const same = result.same && !readsPastEnd(candidate, records)
    const smaller = same && compareTapes(records, best) < 0
    if (smaller) {
      // the next smaller input can take as many runs again
      maxStalledRuns = Math.max(maxStalledRuns, (runs - runsAtLastShrink) * 2)
      for (const stream of records) {
        const previous = best.find((record) => isPath(record, stream.path))
        if (previous) {
          shareSpanLists(previous, stream)
        }
      }
      best = records
      shrunk = true
      runsAtLastShrink = runs
      tried.add(getKey(records))
    } else if (result.slow) {
      slowRuns.push(records)
    }
    options.onProgress?.({ runs, values: countValues(best) })
    return smaller
  }

  const tryValues = (path: string[], values: number[]): Promise<boolean> =>
    tryChanges([{ path, values }])

  const getStream = (path: string[]): RandomTapeRecord | undefined =>
    best.find((stream) => isPath(stream, path))

  const getValues = (path: string[]): number[] | undefined => getStream(path)?.values

  const passes: Pass[] = [
    // the whole fork reads zeros
    { count: () => 1, step: ({ path, values }) => tryValues(path, zeros(values.length)) },
    // remove 1 part, and then the parts that follow it at the same level, for example the next
    // items of `many`
    {
      count: (stream) => getSpansBySize(stream).length,
      step: async (stream, index) => {
        const input = best
        const part = getSpansBySize(stream)[index]
        const remove = (parts: Part[]) =>
          changeParts(input, stream, parts, (values, start, end) => splice(values, start, end, []))
        if (await tryChanges(remove([part]))) {
          const next = getNextParts(stream, part)
          // remove the part and the next `count` parts from the input before the removal
          await findInteger(
            (count) => count <= next.length && tryChanges(remove([part, ...next.slice(0, count)])),
          )
        }
      },
    },
    // replace a part with a smaller part of the same kind inside it, for example a subtree
    {
      count: (stream) => getNestedPairs(stream).length,
      step: (stream, index) => {
        const { outer, inner } = getNestedPairs(stream)[index]
        return tryChanges(
          changeParts(best, stream, [outer], (values, start, end, path) => {
            const range = isPath(stream, path)
              ? inner
              : inner.links?.find((link) => samePath(link.path, path))
            return splice(values, start, end, range ? values.slice(range.start, range.end) : [])
          }),
        )
      },
    },
    // remove values without a part, starting at the end
    {
      count: (stream) => countBlocks(stream.values.length),
      step: ({ path, values }, index) => {
        const { start, end } = getBlock(values.length, index)
        return tryValues(path, splice(values, start, end, []))
      },
    },
    // set a part to zeros
    {
      count: (stream) => getSpansBySize(stream).length,
      step: async (stream, index) => {
        const changes = changeParts(
          best,
          stream,
          [getSpansBySize(stream)[index]],
          (values, start, end) =>
            values.slice(start, end).some(Boolean)
              ? splice(values, start, end, zeros(end - start))
              : values,
        )
        if (changes.length) {
          await tryChanges(changes)
        }
      },
    },
    // set values to zeros, starting at the end
    {
      count: (stream) => countBlocks(stream.values.length),
      step: async ({ path, values }, index) => {
        const { start, end } = getBlock(values.length, index)
        if (values.slice(start, end).some(Boolean)) {
          await tryValues(path, splice(values, start, end, zeros(end - start)))
        }
      },
    },
    // make a value as small as possible
    {
      count: (stream) => stream.values.length,
      step: async ({ path, values }, index) => {
        if (values[index]) {
          await simplifyValue(path, index)
          await searchValue(path, index)
        }
      },
    },
  ]

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

  // the next step of the pass that did not run on the current input
  const nextStep = (state: PassState, randomOrder: boolean): number | undefined => {
    if (state.input !== best) {
      state.input = best
      state.counts = best.map((stream) => state.pass.count(stream))
      state.total = state.counts.reduce((sum, count) => sum + count, 0)
      state.done.clear()
    }
    if (state.done.size >= state.total) {
      return undefined
    }
    let index = randomOrder
      ? random.int(0, state.total - 1)
      : Math.min(state.position, state.total - 1)
    while (state.done.has(index)) {
      index = (index + 1) % state.total
    }
    state.position = index
    state.done.add(index)
    return index
  }

  const runStep = async ({ pass, counts }: PassState, index: number): Promise<void> => {
    for (const [i, stream] of best.entries()) {
      if (index < counts[i]) {
        await pass.step(stream, index)
        return
      }
      index -= counts[i]
    }
  }

  // The order of the passes and the limits come from the shrinker of Hypothesis. A pass runs
  // until `MAX_FAILED_STEPS` steps in a row find no smaller input, and then the next pass gets
  // its turn. The search ends when each step of each pass ran on the current input.
  const states: PassState[] = passes.map((pass) => ({
    pass,
    input: undefined,
    counts: [],
    total: 0,
    done: new Set(),
    position: 0,
    rank: 0,
  }))
  let ran = true
  while (ran && !isStopped()) {
    ran = false
    const runsAtLoopStart = runs
    let maxRunsOfFailedStep = 1
    for (const state of states) {
      const start = best
      let failures = 0
      while (failures < MAX_FAILED_STEPS) {
        // the limit leaves room for the rest of the loop, also if only the last pass finds a
        // smaller input
        maxStalledRuns = Math.max(maxStalledRuns, 2 * maxRunsOfFailedStep + runs - runsAtLoopStart)
        if (isStopped()) {
          break
        }
        const index = nextStep(state, failures >= MAX_FAILED_STEPS / 2)
        if (index === undefined) {
          break
        }
        ran = true
        const input = best
        const runsAtStepStart = runs
        await runStep(state, index)
        if (best !== input) {
          failures = 0
        } else if (runs > runsAtStepStart) {
          maxRunsOfFailedStep = Math.max(maxRunsOfFailedStep, runs - runsAtStepStart)
          failures++
        }
      }
      // the next loop starts with the passes that removed values
      state.rank = best === start ? 1 : countValues(best) < countValues(start) ? -1 : 0
    }
    states.sort((a, b) => a.rank - b.rank)
  }
  // a fork that read no values has only the parts that read other forks
  return { records: withoutZeros(best.filter((record) => record.length)), runs, shrunk, timedOut }
}

// the blocks of each size in `BLOCK_SIZES`, each size from the end
function countBlocks(length: number): number {
  return BLOCK_SIZES.reduce((sum, size) => sum + Math.max(0, length - size + 1), 0)
}

function getBlock(length: number, index: number): Range {
  for (const size of BLOCK_SIZES) {
    const count = Math.max(0, length - size + 1)
    if (index < count) {
      const start = length - size - index
      return { start, end: start + size }
    }
    index -= count
  }
  return { start: 0, end: 0 }
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

/**
 * The count of values that the run read, with the zeros.
 */
export function countValues(streams: RandomTapeStream[]): number {
  return streams.reduce((sum, stream) => sum + (stream.length ?? stream.values.length), 0)
}

// A record leaves out the zeros at the end. The search needs them, because the count of reads is
// a part of the size of an input, and a run must not read more values than its input has.
function withZeros(records: RandomTapeRecord[]): RandomTapeRecord[] {
  return records.map((record) =>
    record.values.length < record.length
      ? { ...record, values: [...record.values, ...zeros(record.length - record.values.length)] }
      : record,
  )
}

function withoutZeros(records: RandomTapeRecord[]): RandomTapeRecord[] {
  return records.map((record) => {
    let end = record.values.length
    while (end > 0 && !record.values[end - 1]) {
      end--
    }
    return end < record.values.length ? { ...record, values: record.values.slice(0, end) } : record
  })
}

function readsPastEnd(candidate: RandomTapeStream[], records: RandomTapeRecord[]): boolean {
  return records.some(
    ({ path, length }) =>
      length > (candidate.find((stream) => isPath(stream, path))?.values.length ?? 0),
  )
}

// a hash keeps the memory small, because an input can have many values
function getKey(streams: RandomTapeStream[]): string {
  const parts: string[] = []
  for (const { path, values } of streams) {
    if (values.length) {
      parts.push(JSON.stringify(path), valuesText(values, values.length))
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
  return samePath(stream.path, path)
}

function samePath(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((label, i) => label === b[i])
}

interface Range {
  start: number
  end: number
}

interface Part extends Range {
  depth: number
  links?: RandomSpanLink[]
}

// the new values of 1 fork in a try
interface Change {
  path: readonly string[]
  values: number[]
}

const spansBySize = new WeakMap<RandomTapeRecord, Part[]>()
const nestedPairs = new WeakMap<RandomTapeRecord, { outer: RandomSpan; inner: RandomSpan }[]>()

// the largest parts first, each range 1 time with its outer level
function getSpansBySize(stream: RandomTapeRecord): Part[] {
  let result = spansBySize.get(stream)
  if (!result) {
    const parts = new Map<string, Part>()
    for (const { start, end, depth, links } of stream.spans) {
      const clampedEnd = Math.min(end, stream.values.length)
      const key = links ? `${start}:${clampedEnd}:${getLinksKey(links)}` : `${start}:${clampedEnd}`
      const existing = parts.get(key)
      if ((clampedEnd > start || links) && (!existing || depth < existing.depth)) {
        parts.set(key, { start, end: clampedEnd, depth, links })
      }
    }
    result = [...parts.values()].sort((a, b) => totalSize(b) - totalSize(a) || a.start - b.start)
    spansBySize.set(stream, result)
  }
  return result
}

function getLinksKey(links: RandomSpanLink[]): string {
  return links.map((link) => `${JSON.stringify(link.path)}${link.start}:${link.end}`).join()
}

// the parts that directly follow `part` at the same level
function getNextParts(stream: RandomTapeRecord, part: Part): Part[] {
  const partsByStart = new Map<number, Part>()
  for (const { start, end, depth, links } of stream.spans) {
    if (depth === part.depth && start >= part.end) {
      partsByStart.set(start, { start, end: Math.min(end, stream.values.length), depth, links })
    }
  }
  const parts: Part[] = []
  let next = partsByStart.get(part.end)
  while (next && next.end > (parts.at(-1)?.end ?? part.end)) {
    parts.push(next)
    next = partsByStart.get(next.end)
  }
  return parts
}

// a part and a smaller part with the same label inside it, the largest difference first
function getNestedPairs(stream: RandomTapeRecord): { outer: RandomSpan; inner: RandomSpan }[] {
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
          totalSize(inner) < totalSize(outer)
        ) {
          pairs.push({ outer, inner })
        }
      }
    }
    pairs.sort(
      (a, b) =>
        totalSize(b.outer) - totalSize(b.inner) - (totalSize(a.outer) - totalSize(a.inner)) ||
        a.outer.start - b.outer.start,
    )
    nestedPairs.set(stream, pairs)
  }
  return pairs
}

// The values of each fork after a change of the parts: in the fork of the parts, and in the forks
// that the parts read. The parts are next to each other. A fork without a change is left out.
function changeParts(
  input: RandomTapeRecord[],
  stream: RandomTapeRecord,
  parts: Part[],
  change: (values: number[], start: number, end: number, path: readonly string[]) => number[],
): Change[] {
  const ranges: RandomSpanLink[] = [
    { path: stream.path, start: parts[0].start, end: parts[parts.length - 1].end },
  ]
  for (const link of parts.flatMap((part) => part.links ?? [])) {
    const range = ranges.find((other) => samePath(other.path, link.path))
    if (range) {
      range.start = Math.min(range.start, link.start)
      range.end = Math.max(range.end, link.end)
    } else {
      ranges.push({ ...link })
    }
  }
  return ranges.flatMap(({ path, start, end }) => {
    const values = input.find((other) => isPath(other, path))?.values
    const changed = values && change(values, start, end, path)
    return changed && changed !== values ? [{ path, values: changed }] : []
  })
}

// the values of a part in its fork and in the forks that it read
function totalSize(part: Range & { links?: RandomSpanLink[] }): number {
  return (part.links ?? []).reduce((sum, link) => sum + size(link), size(part))
}

// a smaller input with the same parts keeps the lists, so that the search does not sort the parts
// again after each change of a value
function shareSpanLists(previous: RandomTapeRecord, next: RandomTapeRecord): void {
  const bySize = spansBySize.get(previous)
  const pairs = nestedPairs.get(previous)
  if ((!bySize && !pairs) || !hasSameSpans(previous, next)) {
    return
  }
  if (bySize) {
    spansBySize.set(next, bySize)
  }
  if (pairs) {
    nestedPairs.set(next, pairs)
  }
}

function hasSameSpans(a: RandomTapeRecord, b: RandomTapeRecord): boolean {
  if (a.values.length !== b.values.length || a.spans.length !== b.spans.length) {
    return false
  }
  return a.spans.every((span, i) => {
    const other = b.spans[i]
    return (
      span.start === other.start &&
      span.end === other.end &&
      span.depth === other.depth &&
      span.label === other.label &&
      hasSameLinks(span.links, other.links)
    )
  })
}

function hasSameLinks(a: RandomSpanLink[] | undefined, b: RandomSpanLink[] | undefined): boolean {
  if (!a || !b) {
    return a === b
  }
  return (
    a.length === b.length &&
    a.every(
      (link, i) =>
        link.start === b[i].start && link.end === b[i].end && samePath(link.path, b[i].path),
    )
  )
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
