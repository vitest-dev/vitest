import { assertType, describe, expectTypeOf, test } from 'vitest'
import { defineConfig, defineProject, defineWorkspace, mergeConfig } from 'vitest/config'

const expectMainTestConfig = expectTypeOf(defineConfig).parameter(0).resolves.toHaveProperty('test').exclude<undefined>()
const expectProjectTestConfig = expectTypeOf(defineProject).parameter(0).resolves.toHaveProperty('test').exclude<undefined>()

describe('define project helper', () => {
  test('cannot define non-project fields on a project config', () => {
    expectProjectTestConfig.toHaveProperty('name')
    expectMainTestConfig.toHaveProperty('name')

    expectProjectTestConfig.not.toHaveProperty('coverage')
    expectMainTestConfig.toHaveProperty('coverage')

    expectProjectTestConfig.not.toHaveProperty('reporters')
    expectMainTestConfig.toHaveProperty('reporters')
  })

  test('allows expected project fields on a project config', () => {
    expectProjectTestConfig.toHaveProperty('pool')
    expectProjectTestConfig.toHaveProperty('poolOptions')
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

describe('define workspace helper', () => {
  type DefineWorkspaceParameter = Parameters<typeof defineWorkspace>[0]

  test('allows string', () => {
    assertType<DefineWorkspaceParameter>(['./path/to/workspace'])
  })

  test('allows config object', () => {
    assertType<DefineWorkspaceParameter>([{
      test: {
        name: 'Workspace Project #1',
        include: ['string'],

        // @ts-expect-error -- Not allowed here
        coverage: {},
      },
    }])
  })

  test('allows mixing strings and config objects', () => {
    assertType<DefineWorkspaceParameter>([
      './path/to/project',
      {
        test: {
          name: 'Workspace Project #1',
          include: ['string'],

          // @ts-expect-error -- Not allowed here
          coverage: {},
        },
      },
      './path/to/another/project',
      {
        extends: 'workspace custom field',
        test: {
          name: 'Workspace Project #2',
          include: ['string'],

          // @ts-expect-error -- Not allowed here
          coverage: {},
        },
      },
    ])
  })

  test('return type matches parameters', () => {
    expectTypeOf(defineWorkspace).returns.toMatchTypeOf<DefineWorkspaceParameter>()

    expectTypeOf(defineWorkspace([
      './path/to/project',
      {
        test: {
          name: 'Workspace Project #1',
          include: ['string'],

          // @ts-expect-error -- Not allowed here
          coverage: {},
        },
      },
      './path/to/another/project',
      {
        extends: 'workspace custom field',
        test: {
          name: 'Workspace Project #2',
          include: ['string'],

          // @ts-expect-error -- Not allowed here
          coverage: {},
        },
      },
    ])).items.toMatchTypeOf<DefineWorkspaceParameter[number]>()
  })
})
