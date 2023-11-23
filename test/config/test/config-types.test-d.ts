import { describe, expectTypeOf, test } from 'vitest'
import { type UserWorkspaceConfig, defineConfig, defineProject, defineWorkspace, mergeConfig } from 'vitest/config'

const expectMainTestConfig = expectTypeOf(defineConfig).parameter(0).resolves.toHaveProperty('test').exclude<undefined>()
const expectProjectTestConfig = expectTypeOf(defineProject).parameter(0).resolves.toHaveProperty('test').exclude<undefined>()

describe('define project helper', () => {
  test('cannot define non-project fields on a project config', () => {
    expectProjectTestConfig.toHaveProperty('name')
    expectMainTestConfig.toHaveProperty('name')

    expectProjectTestConfig.not.toHaveProperty('pool')
    expectMainTestConfig.toHaveProperty('pool')

    expectProjectTestConfig.not.toHaveProperty('coverage')
    expectMainTestConfig.toHaveProperty('coverage')
  })
})

describe('merge config helper', () => {
  test('types are not conflicting', () => {
    expectTypeOf(mergeConfig(
      defineConfig({}),
      defineProject({ test: { name: 'test' } }),
    )).toMatchTypeOf<Record<string, unknown>>()
  })
})

describe('workspace config', () => {
  test('correctly defines return type', () => {
    expectTypeOf(defineWorkspace([{ test: { name: 'test' } }])).items.toMatchTypeOf<UserWorkspaceConfig>()
    expectTypeOf(defineWorkspace(['packages/*'])).items.toBeString()
  })
})
