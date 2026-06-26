#!/usr/bin/env node

import { performance } from 'node:perf_hooks'
import { mergeProcessCovs, mergeScriptCovs } from '@bcoe/v8-coverage'

const coverageFiles = readNumber('COVERAGE_FILES', 800)
const sharedScripts = readNumber('SHARED_SCRIPTS', 40)
const uniqueScripts = readNumber('UNIQUE_SCRIPTS', 2)
const functionsPerScript = readNumber('FUNCTIONS_PER_SCRIPT', 3)
const rangesPerFunction = readNumber('RANGES_PER_FUNCTION', 4)
const batchBytes = readNumber('BATCH_BYTES', 16 * 1024 * 1024)
const processCoverageSizes = Array.from(
  { length: coverageFiles },
  (_, index) => JSON.stringify(makeProcessCoverage(index)).length,
)
const totalCoverageBytes = processCoverageSizes.reduce((total, size) => total + size, 0)
const batchCount = countBatches()

console.log('Synthetic V8 coverage merge reproduction')
console.log(`coverage files: ${coverageFiles}`)
console.log(`shared script URLs per file: ${sharedScripts}`)
console.log(`unique script URLs per file: ${uniqueScripts}`)
console.log(`functions per script: ${functionsPerScript}`)
console.log(`ranges per function: ${rangesPerFunction}`)
console.log(`raw coverage size: ${formatBytes(totalCoverageBytes)}`)
console.log(`batch bytes: ${formatBytes(batchBytes)}`)
console.log(`batch count: ${batchCount}`)
console.log('')

const processMerge = measure('incremental mergeProcessCovs', runMergeProcessCovs)
const batchedProcessMerge = measure('batched mergeProcessCovs', runBatchedMergeProcessCovs)
const scriptMerge = measure('per-URL mergeScriptCovs', runMergeScriptCovs)

assertEquivalent(processMerge.result, scriptMerge.result)
assertEquivalent(batchedProcessMerge.result, scriptMerge.result)

console.table([
  formatMeasurement(processMerge),
  formatMeasurement(batchedProcessMerge),
  formatMeasurement(scriptMerge),
])

console.log(`equivalent output: yes (${processMerge.result.result.length} merged script URLs)`)
console.log(`per-URL speedup over incremental: ${(processMerge.duration / scriptMerge.duration).toFixed(1)}x`)
console.log(`per-URL vs batched: ${(scriptMerge.duration / batchedProcessMerge.duration).toFixed(1)}x slower`)
console.log('')
console.log('Tune with COVERAGE_FILES, SHARED_SCRIPTS, UNIQUE_SCRIPTS, FUNCTIONS_PER_SCRIPT, RANGES_PER_FUNCTION, and BATCH_BYTES.')

function runMergeProcessCovs() {
  let merged = { result: [] }

  for (let index = 0; index < coverageFiles; index++) {
    merged = mergeProcessCovs([merged, makeProcessCoverage(index)])
  }

  return merged
}

function runBatchedMergeProcessCovs() {
  let merged = { result: [] }
  let batch = []
  let currentBatchBytes = 0

  for (let index = 0; index < coverageFiles; index++) {
    batch.push(makeProcessCoverage(index))
    currentBatchBytes += processCoverageSizes[index]

    if (currentBatchBytes >= batchBytes) {
      merged = mergeProcessCovs([merged, ...batch])
      batch = []
      currentBatchBytes = 0
    }
  }

  if (batch.length > 0) {
    merged = mergeProcessCovs([merged, ...batch])
  }

  return merged
}

function countBatches() {
  let count = 0
  let currentBatchBytes = 0

  for (const size of processCoverageSizes) {
    currentBatchBytes += size

    if (currentBatchBytes >= batchBytes) {
      count++
      currentBatchBytes = 0
    }
  }

  if (currentBatchBytes > 0) {
    count++
  }

  return count
}

function runMergeScriptCovs() {
  const mergedScripts = new Map()

  for (let index = 0; index < coverageFiles; index++) {
    for (const script of makeProcessCoverage(index).result) {
      const previous = mergedScripts.get(script.url)
      const merged = mergeScriptCovs(previous ? [previous, script] : [script])

      mergedScripts.set(merged.url, merged)
    }
  }

  const result = Array.from(mergedScripts.values())
    .sort((a, b) => a.url.localeCompare(b.url))

  for (const [scriptId, script] of result.entries()) {
    script.scriptId = String(scriptId)
  }

  return { result }
}

function makeProcessCoverage(index) {
  const result = []

  for (let scriptIndex = 0; scriptIndex < sharedScripts; scriptIndex++) {
    result.push(makeScriptCoverage(`file:///shared-${scriptIndex}.ts`, index, scriptIndex))
  }

  for (let scriptIndex = 0; scriptIndex < uniqueScripts; scriptIndex++) {
    const uniqueIndex = sharedScripts + scriptIndex
    result.push(makeScriptCoverage(`file:///suite-${index}/module-${scriptIndex}.ts`, index, uniqueIndex))
  }

  return { result }
}

function makeScriptCoverage(url, processIndex, scriptIndex) {
  const functions = []

  for (let functionIndex = 0; functionIndex < functionsPerScript; functionIndex++) {
    functions.push(makeFunctionCoverage(processIndex, scriptIndex, functionIndex))
  }

  return {
    scriptId: `${processIndex}:${scriptIndex}`,
    url,
    functions,
    startOffset: 0,
  }
}

function makeFunctionCoverage(processIndex, scriptIndex, functionIndex) {
  const startOffset = functionIndex * 100
  const endOffset = startOffset + 90
  const ranges = [{ startOffset, endOffset, count: 1 }]

  for (let rangeIndex = 1; rangeIndex < rangesPerFunction; rangeIndex++) {
    const childStart = startOffset + rangeIndex * 10
    ranges.push({
      startOffset: childStart,
      endOffset: childStart + 5,
      count: (processIndex + scriptIndex + functionIndex + rangeIndex) % 3,
    })
  }

  return {
    functionName: `fn${functionIndex}`,
    ranges,
    isBlockCoverage: true,
  }
}

function measure(label, fn) {
  runGc()
  const startHeap = process.memoryUsage().heapUsed
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  runGc()
  const heap = process.memoryUsage().heapUsed

  return {
    label,
    result,
    duration,
    heapDelta: heap - startHeap,
  }
}

function assertEquivalent(actual, expected) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)

  if (actualJson !== expectedJson) {
    throw new Error('merge outputs differ')
  }
}

function formatMeasurement(measurement) {
  return {
    'strategy': measurement.label,
    'time ms': measurement.duration.toFixed(1),
    'heap delta': formatBytes(measurement.heapDelta),
  }
}

function readNumber(name, fallback) {
  const value = process.env[name] == null
    ? fallback
    : Number.parseInt(process.env[name], 10)

  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`)
  }

  return value
}

function runGc() {
  if (globalThis.gc) {
    globalThis.gc()
  }
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? '-' : ''
  const absolute = Math.abs(bytes)

  if (absolute < 1024 * 1024) {
    return `${sign}${(absolute / 1024).toFixed(1)} KiB`
  }

  return `${sign}${(absolute / 1024 / 1024).toFixed(1)} MiB`
}
