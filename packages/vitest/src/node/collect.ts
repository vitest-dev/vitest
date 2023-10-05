/* eslint-disable no-console */

import { mkdirSync, writeFileSync } from 'node:fs'
import type { File } from '@vitest/runner'
import { dirname, resolve } from 'pathe'
import { getNames, getTests } from '../utils'
import type { CliOptions } from './cli-api'

export function processCollected(files: File[], options: CliOptions) {
  if (typeof options.json === 'boolean')
    return console.log(JSON.stringify(formatCollectedAsJSON(files), null, 2))

  if (typeof options.json === 'string') {
    const jsonPath = resolve(options.root || process.cwd(), options.json)
    mkdirSync(dirname(jsonPath), { recursive: true })
    writeFileSync(jsonPath, JSON.stringify(formatCollectedAsJSON(files), null, 2))
    return
  }

  return formatCollectedAsString(files).forEach(test => console.log(test))
}

export function formatCollectedAsJSON(files: File[]) {
  return files.map((file) => {
    const tests = getTests(file)
    return tests.map(test => ({ name: getNames(test).slice(1).join(' > '), file: file.filepath }))
  }).flat()
}

export function formatCollectedAsString(files: File[]) {
  return files.map((file) => {
    const tests = getTests(file).filter(test => test.mode === 'run' || test.mode === 'only')
    return tests.map(test => getNames(test).join(' > '))
  }).flat()
}
