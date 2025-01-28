import {describe, expect, test, type TestAPI} from 'vitest'

const myTest = test as TestAPI<{result: (name: string) => Promise<unknown>}>

describe('await multiple prior test result', () => {
	myTest('first', async () => {
		expect(1).toBe(1)
		return 1
	})

	myTest('second', async () => {
		expect(1).toBe(1)
		return 2
	})

	myTest('third', async () => {
		expect(1).toBe(1)
		return 3
	})

	myTest.only('with await', async ({result}) => {
		const third = await result('await multiple prior test result | third')
		expect(third).toBe(3)

		const second = await result('await multiple prior test result | second')
		expect(second).toBe(2)

		const first = await result('await multiple prior test result | first')
		expect(first).toEqual(1)
	})
})

myTest.only('supports passing options', {repeats: 2}, context => {
	expect(context.task.repeats).toBe(2)
})

describe.only('extendable', () => {
	const newTest = myTest.extend({
		foo: 'bar',
		// eslint-disable-next-line no-empty-pattern
		baz: async ({}, use) => {
			await use('qux')
		},
	})
	newTest('check non func', ({foo}) => {
		expect(foo).toBe('bar')
		return 'bar'
	})
	newTest('check func', async ({baz, result}) => {
		expect(baz).toBe('qux')
		await expect(result('extendable | check non func')).resolves.toBe('bar')
	})
})
