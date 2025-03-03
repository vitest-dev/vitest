import {describe, expect, test as baseTest, type TestAPI} from 'vitest'

const test = baseTest as TestAPI<{__suiteNames: string[]}>

test("test-a", (ctx) => {
	expect(ctx.__suiteNames).toEqual([]);
})

describe("suite-x", () => {
	test("test-b", (ctx) => {
		expect(ctx.__suiteNames).toEqual(
			['suite-x']
		)
	})

	describe("suite-y", () => {
		test("test-c", (ctx) => {
			expect(ctx.__suiteNames).toEqual(
				['suite-y', 'suite-x']
			)
		})
	})
})
