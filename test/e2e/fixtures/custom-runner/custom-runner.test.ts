import {describe, expect, test as baseTest, type TestAPI} from 'vitest'
import { getSuiteNames } from './utils';

const test = baseTest as TestAPI<{__suiteNames: string[]}>

test("test-a", (ctx) => {
	expect(ctx.__suiteNames).toEqual([]);
	expect(ctx.__suiteNames).toEqual(getSuiteNames(ctx.task.suite))
})

describe("suite-x", () => {
	test("test-b", (ctx) => {
		expect(ctx.__suiteNames).toEqual(['suite-x'])
		expect(ctx.__suiteNames).toEqual(getSuiteNames(ctx.task.suite))
	})

	describe("suite-y", () => {
		test("test-c", (ctx) => {
			expect(ctx.__suiteNames).toEqual(['suite-y', 'suite-x'])
			expect(ctx.__suiteNames).toEqual(getSuiteNames(ctx.task.suite))
		})
	})
})
