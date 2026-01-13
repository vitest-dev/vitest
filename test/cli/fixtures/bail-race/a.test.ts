import { setTimeout } from 'node:timers/promises'
import {afterAll, expect, test } from 'vitest'


test('adds two numbers', () => {
  expect(2 + 3).toBe(5)
})

test('fails adding two numbers', () => {
  expect(2 + 3).toBe(6)
})
