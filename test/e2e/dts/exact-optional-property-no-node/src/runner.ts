import type { VitestRunner } from '@vitest/runner'
import type { FailureScreenshotArtifact } from '@vitest/runner/types'
import { TestRunner } from 'vitest'

type _Override = FailureScreenshotArtifact

export class MyRunner extends TestRunner implements VitestRunner {}
