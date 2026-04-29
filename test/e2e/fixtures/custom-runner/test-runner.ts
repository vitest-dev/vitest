import type { TestContext } from '@vitest/runner'
import { TestRunner } from 'vitest'
import { getSuiteNames } from './utils';

class CustomTestRunner extends TestRunner {
	extendTaskContext(context: TestContext) {
    super.extendTaskContext(context);
		(context as any).__suiteNames = getSuiteNames(context.task.suite)
    return context
	}
}

export default CustomTestRunner
