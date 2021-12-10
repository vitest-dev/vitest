import chai from 'chai'
import Snap from 'jest-snapshot'
import type {
  SnapshotStateType,
  SnapshotResolver,
} from 'jest-snapshot'

import type { SnapshotStateOptions } from 'jest-snapshot/build/State'
import { Test } from '../../types'
import {
  packSnapshotState,
  addSnapshotResult,
  makeEmptySnapshotSummary,
} from './utils/jest-test-result-helper'
import { getSnapshotSummaryOutput } from './utils/jest-reporters-lite'
import { SnapshotSummary } from './utils/types'

const { expect } = chai
const { SnapshotState } = Snap

export interface Context {
  file: string
  title?: string
  fullTitle?: string
}

export class SnapshotManager {
  snapshotState: SnapshotStateType | null = null
  snapshotSummary: SnapshotSummary
  snapshotOptions: SnapshotStateOptions
  ctx: Context | null = null
  testFile = ''
  snapshotResolver: SnapshotResolver | null
  rootDir: string

  constructor({
    rootDir,
    update,
    snapshotResolver = null,
  }: {
    rootDir: string
    update?: boolean
    snapshotResolver?: SnapshotResolver | null
  }) {
    this.rootDir = rootDir
    this.snapshotResolver = snapshotResolver

    const env = process.env
    const CI = !!env.CI
    const UPDATE_SNAPSHOT = update || env.UPDATE_SNAPSHOT

    this.snapshotOptions = {
      updateSnapshot: CI && !UPDATE_SNAPSHOT
        ? 'none'
        : UPDATE_SNAPSHOT
          ? 'all'
          : 'new',
    } as SnapshotStateOptions

    this.snapshotSummary = makeEmptySnapshotSummary(this.snapshotOptions)
  }

  onFileChanged(): void {
    if (!this.ctx) return

    if (this.snapshotState !== null) this.saveSnap()

    this.testFile = this.ctx.file
    this.snapshotState = new SnapshotState(
      this.snapshotResolver!.resolveSnapshotPath(this.testFile),
      this.snapshotOptions,
    )
  }

  setTest(test: Test) {
    this.setContext({
      file: test.file?.filepath || test.name,
      title: test.name,
      fullTitle: [test.suite.name, test.name].filter(Boolean).join(' > '),
    })
  }

  setContext(context: Context): void {
    if (!context.title || !context.file) return

    this.ctx = context
    if (this.testFile !== context.file) this.onFileChanged()
  }

  assert(received: unknown, message: string): void {
    if (!this.snapshotState || !this.ctx) return

    const { actual, expected, key, pass } = this.snapshotState.match({
      testName: this.ctx.fullTitle || this.ctx.title || this.ctx.file,
      received,
      isInline: false,
    })
    if (!pass) {
      expect(actual.trim()).equals(
        expected ? expected.trim() : '',
        message || `Snapshot name: \`${key}\``,
      )
    }
  }

  clear() {
    this.snapshotSummary = makeEmptySnapshotSummary(this.snapshotOptions)
  }

  saveSnap(): void {
    if (!this.testFile || !this.snapshotState) return

    const packedSnapshotState = packSnapshotState(this.snapshotState)
    addSnapshotResult(this.snapshotSummary, packedSnapshotState, this.testFile)

    this.testFile = ''
    this.snapshotState = null
  }

  report() {
    const outputs = getSnapshotSummaryOutput(
      this.rootDir,
      this.snapshotSummary,
    )
    if (outputs.length > 1)
      return outputs
  }
}
