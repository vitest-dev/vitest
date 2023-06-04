import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

function runTest(name: string) {
  return runVitest({ root: './fixtures' }, [resolve(`./fixtures/test/${name}.test.ts`)])
}

describe('soft expect', () => {
  test('should work in test', async () => {
    const { stderr } = await runTest('inside-test')

    expect(stderr).toContain('one plus one')
    expect(stderr).toContain('two plus two')
    expect(stderr).toContain('three plus three')
    expect(stderr).toContain('one times one')
    expect(stderr).toContain('two times two')
    expect(stderr).toContain('three times three')
  })

  test('should work in afterAll', async () => {
    const { stderr } = await runTest('after-all')

    expect(stderr).toContain('one plus one')
    expect(stderr).toContain('two plus two')
    expect(stderr).toContain('three plus three')
    expect(stderr).toContain('one times one')
    expect(stderr).toContain('two times two')
    expect(stderr).toContain('three times three')
  })

  test('should work in beforeAll', async () => {
    const { stderr } = await runTest('before-all')

    expect(stderr).toContain('one plus one')
    expect(stderr).toContain('two plus two')
    expect(stderr).toContain('three plus three')
    expect(stderr).toContain('one times one')
    expect(stderr).toContain('two times two')
    expect(stderr).toContain('three times three')
  })

  test('should work in beforeEach', async () => {
    const { stderr } = await runTest('before-each')

    expect(stderr).toContain('one plus one')
    expect(stderr).toContain('two plus two')
    expect(stderr).toContain('three plus three')
    expect(stderr).toContain('one times one')
    expect(stderr).toContain('two times two')
    expect(stderr).toContain('three times three')
  })

  test('should work in afterEach', async () => {
    const { stderr } = await runTest('after-each')

    expect(stderr).toContain('one plus one')
    expect(stderr).toContain('two plus two')
    expect(stderr).toContain('three plus three')
    expect(stderr).toContain('one times one')
    expect(stderr).toContain('two times two')
    expect(stderr).toContain('three times three')
  })
})
