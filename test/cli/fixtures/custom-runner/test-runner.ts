import type { Suite, TestContext } from '@vitest/runner'
import { VitestTestRunner } from 'vitest/runners'

class CustomTestRunner extends VitestTestRunner {
	extendTaskContext(context: TestContext) {
    super.extendTaskContext(context);
		(context as any).__suiteNames = getSuiteNames(context.task.suite);
    return context
	}
}

function getSuiteNames(suite?: Suite) {
	const names = []
	while (suite) {
		names.push(suite.name)
		suite = suite.suite
	}
	return names
}

export default CustomTestRunner
