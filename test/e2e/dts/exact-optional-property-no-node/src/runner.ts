import type { FailureScreenshotArtifact, VitestTestRunner } from 'vitest'
import { TestRunner } from 'vitest'

type _Override = FailureScreenshotArtifact

export class MyRunner extends TestRunner implements VitestTestRunner {}
