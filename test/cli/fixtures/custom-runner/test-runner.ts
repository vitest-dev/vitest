import type { Suite, TestContext } from '@vitest/runner'
import { VitestTestRunner } from 'vitest/runners'
import { getSuiteNames } from './utils';

class CustomTestRunner extends VitestTestRunner {
	extendTaskContext(context: TestContext) {
    super.extendTaskContext(context);
		(context as any).__suiteNames = getSuiteNames(context.task.suite)
    return context
	}
}

export default CustomTestRunner
