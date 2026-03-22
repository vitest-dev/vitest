import type { VitestRunner } from '@vitest/runner'
import type { FailureScreenshotArtifact } from '@vitest/runner/types'
import { VitestTestRunner } from 'vitest/runners'

type _Override = FailureScreenshotArtifact

export class MyRunner extends VitestTestRunner implements VitestRunner {}
