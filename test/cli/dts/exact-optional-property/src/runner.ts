import type { VitestRunner } from '@vitest/runner'
import { VitestTestRunner } from 'vitest/runners'

export class MyRunner extends VitestTestRunner implements VitestRunner {}
