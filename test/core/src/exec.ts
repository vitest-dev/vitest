/* eslint-disable import/no-duplicates */
import { exec } from 'child_process'
import * as child_process from 'child_process'
import defaultProcess from 'child_process'

export function execHelloWorld() {
  exec('hello world')
}

export function execImportAll() {
  child_process.exec('import all')
}

export function execDefault() {
  defaultProcess.exec('default')
}
