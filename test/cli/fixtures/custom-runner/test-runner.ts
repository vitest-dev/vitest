import type { Task, TestContext } from '@vitest/runner'
import { getFn } from '@vitest/runner'
import { VitestTestRunner } from 'vitest/runners'

/** This adds `result` to the test context, which allows for awaiting prior test results,
 * enabling sharing of expensive results between tests while enforcing a correct ordering of tests. */
class CustomTestRunner extends VitestTestRunner {
	constructor(config: ConstructorParameters<typeof VitestTestRunner>[0]) {
		super(config)
	}
	tasks: Record<string, Task> = {}
	_results: Record<string, unknown> = {}

  result = (prop: string) => {
		if (!(prop in this._results)) {
			const task = this.tasks[prop as string]
			if (!task) {
				throw new Error(
					`Task ${String(prop)} not found. Known tests: ${Object.keys(
						this.tasks
					)
						.map(name => JSON.stringify(name))
						.join(', ')}`
				)
			}
			// this fills in the results for the task
			this.runTask(task)
		}
		return this._results[prop]
	}

	getName(test: Task) {
		const name = test.suite?.name
			? `${test.suite.name} | ${test.name}`
			: test.name
		return name
	}

	runTask(test: Task) {
		const name = this.getName(test)
		const fn = getFn(test)

		const results = fn()
		this._results[name] = results
		return results
	}

	extendTaskContext(context: TestContext) {
    super.extendTaskContext(context)
		// we need to store the task so we can run it when the results are requested
		const {task} = context
		const testName = this.getName(task)
		this.tasks[testName] = task
    ;(context as any).result = this.result

    return context
	}
}

export default CustomTestRunner
