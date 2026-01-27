import { expect, test } from 'vitest'
import type { NewPlugin } from '@vitest/pretty-format'
import { getCurrentTest } from '@vitest/runner'

const AlwaysFailingSnapshotSerializer: NewPlugin = {
  test: obj => obj && obj.forceFail === true,
  serialize: () => {
    throw new Error('Intentional snapshot serialization failure for testing')
  },
}
expect.addSnapshotSerializer(AlwaysFailingSnapshotSerializer)

test('expect.soft tracks an error for toMatchSnapshot', () => {
  expect.soft({ forceFail: true }).toMatchSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(1)
  expect(getCurrentTest()?.result?.state).toBe('fail')
  passTestIfInFailedStateWithErrors()
})

test('expect.soft tracks multiple errors for toMatchSnapshot', () => {
  expect.soft({ forceFail: true }).toMatchSnapshot()
  expect.soft({ forceFail: true }).toMatchSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  expect(getCurrentTest()?.result?.state).toBe('fail')
  passTestIfInFailedStateWithErrors()
})

test('expect.soft tracks errors across successes for toMatchSnapshot', () => {
  expect.soft('I have a matching snapshot').toMatchSnapshot()
  expect.soft({ forceFail: true }).toMatchSnapshot()
  expect.soft('I also have a matching snapshot').toMatchSnapshot()
  expect.soft({ forceFail: true }).toMatchSnapshot()
  expect.soft('Yet another matching snapshot').toMatchSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  expect(getCurrentTest()?.result?.state).toBe('fail')
  passTestIfInFailedStateWithErrors()
})

test('expect.soft tracks errors for matchSnapshot', () => {
  expect.soft({ forceFail: true }).matchSnapshot()
  expect.soft('I also have a matching snapshot').toMatchSnapshot()
  expect.soft({ forceFail: true }).matchSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  expect(getCurrentTest()?.result?.state).toBe('fail')
  passTestIfInFailedStateWithErrors()
})

test('expect.soft tracks errors for toMatchFileSnapshot', async () => {
  await expect.soft({ forceFail: true }).toMatchFileSnapshot('fake-path/to-non-existent/file')
  expect.soft('Another matching snapshot').toMatchSnapshot()
  await expect.soft({ forceFail: true }).toMatchFileSnapshot('fake-path/to-non-existent/file')

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  expect(getCurrentTest()?.result?.state).toBe('fail')
  passTestIfInFailedStateWithErrors()
})

test('expect.soft tracks errors for toThrowErrorMatchingSnapshot', async () => {
  expect.soft({ forceFail: true }).toThrowErrorMatchingSnapshot()
  expect.soft('Yet another matching snapshot').toMatchSnapshot()
  expect.soft({ forceFail: true }).toThrowErrorMatchingSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  expect(getCurrentTest()?.result?.state).toBe('fail')
  passTestIfInFailedStateWithErrors()
})

function passTestIfInFailedStateWithErrors() {
  const result = getCurrentTest()!.result!

  if (result.errors && result.state === 'fail') {
    result.state = 'pass'
  }
}