/* eslint-disable import/no-duplicates */
import { exec } from 'child_process'
import * as child_process from 'child_process'

export function execHelloWorld() {
  exec('hello world')
}

export function execDefault() {
  child_process.exec('default')
}
