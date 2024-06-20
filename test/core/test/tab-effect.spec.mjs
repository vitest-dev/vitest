/* eslint-disable */
import { expect, test, vi } from 'vitest'
import { join as joinPath } from 'node:path'

const helloWorld = () => {
return joinPath('hello', 'world')
}

test('Are you mocking me?', () => {
// note there are NO indents in this file
// except the next line
// test pass with spaces, test fails with tab
	vi.mock('node:path', () => {
return {
join: vi.fn().mockReturnValue('goodbye world')
}
})
expect(helloWorld()).toBe('goodbye world')
})
