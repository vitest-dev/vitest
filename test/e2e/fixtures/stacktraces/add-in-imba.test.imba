import {it, expect} from 'vitest'

export def add(...args)
	return args.reduce((do(a, b) a + b), 0)

it "add", do
	expect(add()).toBe 0
	expect(add(1)).toBe 3
	expect(add(1, 2, 3)).toBe 6
