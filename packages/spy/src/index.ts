import type {
  Classes,
  Constructable,
  Methods,
  Mock,
  MockConfig,
  MockContext,
  MockInstanceOption,
  MockProcedureContext,
  MockResult,
  MockReturnType,
  MockSettledResult,
  Procedure,
  Properties,
} from './types'

export function isMockFunction(fn: any): fn is Mock {
  return (
    typeof fn === 'function' && '_isMockFunction' in fn && fn._isMockFunction === true
  )
}

const MOCK_RESTORE = new Set<() => void>()
// Jest keeps the state in a separate WeakMap which is good for memory,
// but it makes the state slower to access and return different values
// if you stored it before calling `mockClear` where it will be recreated
const REGISTERED_MOCKS = new Set<Mock>()
const MOCK_CONFIGS = new WeakMap<Mock, MockConfig>()

export function createMockInstance(options: MockInstanceOption = {}): Mock {
  const {
    originalImplementation,
    restore,
    mockImplementation,
    resetToMockImplementation,
    resetToMockName,
  } = options

  if (restore) {
    MOCK_RESTORE.add(restore)
  }

  const config = getDefaultConfig(originalImplementation)
  const state = getDefaultState()

  const mock = createMock({
    config,
    state,
    ...options,
  })
  // inherit the default name so it appears in snapshots and logs
  // this is used by `vi.spyOn()` for better debugging.
  // when `vi.fn()` is called, we just use the default string
  if (resetToMockName) {
    config.mockName = mock.name || 'vi.fn()'
  }
  MOCK_CONFIGS.set(mock, config)
  REGISTERED_MOCKS.add(mock)

  mock._isMockFunction = true
  mock.getMockImplementation = () => {
    // Jest only returns `config.mockImplementation` here,
    // but we think it makes sense to return what the next function will be called
    return config.onceMockImplementations[0] || config.mockImplementation
  }

  Object.defineProperty(mock, 'mock', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: state,
  })

  mock.mockImplementation = function mockImplementation(implementation) {
    config.mockImplementation = implementation
    return mock
  }

  mock.mockImplementationOnce = function mockImplementationOnce(implementation) {
    config.onceMockImplementations.push(implementation)
    return mock
  }

  mock.withImplementation = function withImplementation(implementation, callback) {
    const previousImplementation = config.mockImplementation
    const previousOnceImplementations = config.onceMockImplementations

    const reset = () => {
      config.mockImplementation = previousImplementation
      config.onceMockImplementations = previousOnceImplementations
    }

    config.mockImplementation = implementation
    config.onceMockImplementations = []

    const returnValue = callback()

    if (typeof returnValue === 'object' && typeof (returnValue as Promise<any>)?.then === 'function') {
      return (returnValue as Promise<any>).then(() => {
        reset()
        return mock
      }) as any
    }
    else {
      reset()
    }
    return mock
  }

  mock.mockReturnThis = function mockReturnThis() {
    return mock.mockImplementation(function (this: any) {
      return this
    })
  }

  mock.mockReturnValue = function mockReturnValue(value) {
    return mock.mockImplementation(() => value)
  }

  mock.mockReturnValueOnce = function mockReturnValueOnce(value) {
    return mock.mockImplementationOnce(() => value)
  }

  mock.mockResolvedValue = function mockResolvedValue(value) {
    return mock.mockImplementation(() => Promise.resolve(value))
  }

  mock.mockResolvedValueOnce = function mockResolvedValueOnce(value) {
    return mock.mockImplementationOnce(() => Promise.resolve(value))
  }

  mock.mockRejectedValue = function mockRejectedValue(value) {
    return mock.mockImplementation(() => Promise.reject(value))
  }

  mock.mockRejectedValueOnce = function mockRejectedValueOnce(value) {
    return mock.mockImplementationOnce(() => Promise.reject(value))
  }

  mock.mockClear = function mockClear() {
    state.calls = []
    state.contexts = []
    state.instances = []
    state.invocationCallOrder = []
    state.results = []
    state.settledResults = []
    return mock
  }

  mock.mockReset = function mockReset() {
    mock.mockClear()
    config.mockImplementation = resetToMockImplementation
      ? mockImplementation
      : undefined
    config.mockName = resetToMockName ? (mock.name || 'vi.fn()') : 'vi.fn()'
    config.onceMockImplementations = []
    return mock
  }

  mock.mockRestore = function mockRestore() {
    mock.mockReset()
    return restore?.()
  }

  mock.mockName = function mockName(name: string) {
    if (typeof name === 'string') {
      config.mockName = name
    }
    return mock
  }

  mock.getMockName = function getMockName() {
    return config.mockName || 'vi.fn()'
  }

  if (Symbol.dispose) {
    mock[Symbol.dispose] = () => mock.mockRestore()
  }

  if (mockImplementation) {
    mock.mockImplementation(mockImplementation)
  }

  return mock
}

export function fn<T extends Procedure | Constructable = Procedure>(
  originalImplementation?: T,
): Mock<T> {
  return createMockInstance({
    // we pass this down so getMockImplementation() always returns the value
    mockImplementation: originalImplementation,
    // special case so that .mockReset() resets the value to
    // the the originalImplementation instead of () => undefined
    resetToMockImplementation: true,
  }) as Mock<T>
}

export function spyOn<T extends object, S extends Properties<Required<T>>>(
  object: T,
  key: S,
  accessor: 'get'
): Mock<() => T[S]>
export function spyOn<T extends object, G extends Properties<Required<T>>>(
  object: T,
  key: G,
  accessor: 'set'
): Mock<(arg: T[G]) => void>
export function spyOn<T extends object, M extends Classes<Required<T>> | Methods<Required<T>>>(
  object: T,
  key: M
): Required<T>[M] extends { new (...args: infer A): infer R }
  ? Mock<{ new (...args: A): R }>
  : T[M] extends Procedure
    ? Mock<T[M]>
    : never
export function spyOn<T extends object, K extends keyof T>(
  object: T,
  key: K,
  accessor?: 'get' | 'set',
): Mock {
  assert(
    object != null,
    'The vi.spyOn() function could not find an object to spy upon. The first argument must be defined.',
  )

  assert(
    typeof object === 'object' || typeof object === 'function',
    'Vitest cannot spy on a primitive value.',
  )

  const [originalDescriptorObject, originalDescriptor] = getDescriptor(object, key) || []
  assert(
    originalDescriptor || key in object,
    `The property "${String(key)}" is not defined on the ${typeof object}.`,
  )
  let accessType: 'get' | 'set' | 'value' = accessor || 'value'
  let ssr = false

  // vite ssr support - actual function is stored inside a getter
  if (
    accessType === 'value'
    && originalDescriptor
    && originalDescriptor.value == null
    && originalDescriptor.get
  ) {
    accessType = 'get'
    ssr = true
  }

  let original: Procedure | undefined

  if (originalDescriptor) {
    original = originalDescriptor[accessType]
  }
  else if (accessType !== 'value') {
    original = () => object[key]
  }
  else {
    original = object[key] as unknown as Procedure
  }

  if (isMockFunction(original)) {
    return original
  }

  const reassign = (cb: any) => {
    const { value, ...desc } = originalDescriptor || {
      configurable: true,
      writable: true,
    }
    if (accessType !== 'value') {
      delete desc.writable // getter/setter can't have writable attribute at all
    }
    ;(desc as PropertyDescriptor)[accessType] = cb
    Object.defineProperty(object, key, desc)
  }

  const restore = () => {
    // if method is defined on the prototype, we can just remove it from
    // the current object instead of redefining a copy of it
    if (originalDescriptorObject !== object) {
      Reflect.deleteProperty(object, key)
    }
    else if (originalDescriptor && !original) {
      Object.defineProperty(object, key, originalDescriptor)
    }
    else {
      reassign(original)
    }
  }

  const mock = createMockInstance({
    restore,
    originalImplementation: ssr && original ? original() : original,
    resetToMockName: true,
  })

  try {
    reassign(
      ssr
        ? () => mock
        : mock,
    )
  }
  catch (error) {
    if (
      error instanceof TypeError
      && Symbol.toStringTag
      && (object as any)[Symbol.toStringTag] === 'Module'
      && (error.message.includes('Cannot redefine property')
        || error.message.includes('Cannot replace module namespace')
        || error.message.includes('can\'t redefine non-configurable property'))
    ) {
      throw new TypeError(
        `Cannot spy on export "${String(key)}". Module namespace is not configurable in ESM. See: https://vitest.dev/guide/browser/#limitations`,
        { cause: error },
      )
    }

    throw error
  }

  return mock
}

function getDescriptor(obj: any, method: string | symbol | number): [any, PropertyDescriptor] | undefined {
  const objDescriptor = Object.getOwnPropertyDescriptor(obj, method)
  if (objDescriptor) {
    return [obj, objDescriptor]
  }
  let currentProto = Object.getPrototypeOf(obj)
  while (currentProto !== null) {
    const descriptor = Object.getOwnPropertyDescriptor(currentProto, method)
    if (descriptor) {
      return [currentProto, descriptor]
    }
    currentProto = Object.getPrototypeOf(currentProto)
  }
}

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

let invocationCallCounter = 1

function createMock(
  {
    state,
    config,
    name: mockName,
    prototypeState,
    prototypeConfig,
    keepMembersImplementation,
    prototypeMembers = [],
  }: MockInstanceOption & {
    state: MockContext
    config: MockConfig
  },
) {
  const original = config.mockOriginal
  const name = (mockName || original?.name || 'Mock') as string
  const namedObject: Record<string, Mock<Procedure | Constructable>> = {
    // to keep the name of the function intact
    [name]: (function (this: any, ...args: any[]) {
      registerCalls(args, state, prototypeState)
      registerInvocationOrder(invocationCallCounter++, state, prototypeState)

      const result = {
        type: 'incomplete',
        value: undefined,
      } as MockResult<Procedure>

      const settledResult = {
        type: 'incomplete',
        value: undefined,
      } as MockSettledResult<Procedure>

      registerResult(result, state, prototypeState)
      registerSettledResult(settledResult, state, prototypeState)

      const context = new.target ? undefined : this
      const [instanceIndex, instancePrototypeIndex] = registerInstance(context, state, prototypeState)
      const [contextIndex, contextPrototypeIndex] = registerContext(context, state, prototypeState)

      const implementation: Procedure | Constructable
        = config.onceMockImplementations.shift()
          || config.mockImplementation
          || prototypeConfig?.onceMockImplementations.shift()
          || prototypeConfig?.mockImplementation
          || original
          || function () {}

      let returnValue
      let thrownValue
      let didThrow = false

      try {
        if (new.target) {
          returnValue = Reflect.construct(implementation, args, new.target)

          // jest calls this before the implementation, but we have to resolve this _after_
          // because we cannot do it before the `Reflect.construct` called the custom implementation.
          // fortunetly, the constructor is always an empty functon because `prototypeMethods`
          // are only used by the automocker, so this doesn't matter
          for (const prop of prototypeMembers) {
            const prototypeMock = returnValue[prop]
            const isMock = isMockFunction(prototypeMock)
            const prototypeState = isMock ? prototypeMock.mock : undefined
            const prototypeConfig = isMock ? MOCK_CONFIGS.get(prototypeMock) : undefined
            returnValue[prop] = createMockInstance({
              originalImplementation: keepMembersImplementation
                ? prototypeConfig?.mockOriginal
                : undefined,
              prototypeState,
              prototypeConfig,
              keepMembersImplementation,
            })
          }
        }
        else {
          returnValue = (implementation as Procedure).apply(this, args)
        }
      }
      catch (error: any) {
        thrownValue = error
        didThrow = true
        if (error instanceof TypeError && error.message.includes('is not a constructor')) {
          console.warn(`[vitest] The ${namedObject[name].getMockName()} mock did not use 'function' or 'class' in its implementation, see https://vitest.dev/api/vi#vi-spyon for examples.`)
        }
        throw error
      }
      finally {
        if (didThrow) {
          result.type = 'throw'
          result.value = thrownValue

          settledResult.type = 'rejected'
          settledResult.value = thrownValue
        }
        else {
          result.type = 'return'
          result.value = returnValue

          if (new.target) {
            state.contexts[contextIndex - 1] = returnValue
            state.instances[instanceIndex - 1] = returnValue

            if (contextPrototypeIndex != null && prototypeState) {
              prototypeState.contexts[contextPrototypeIndex - 1] = returnValue
            }
            if (instancePrototypeIndex != null && prototypeState) {
              prototypeState.instances[instancePrototypeIndex - 1] = returnValue
            }
          }

          if (returnValue instanceof Promise) {
            returnValue.then(
              (settledValue) => {
                settledResult.type = 'fulfilled'
                settledResult.value = settledValue
              },
              (rejectedValue) => {
                settledResult.type = 'rejected'
                settledResult.value = rejectedValue
              },
            )
          }
          else {
            settledResult.type = 'fulfilled'
            settledResult.value = returnValue
          }
        }
      }

      return returnValue
    }) as Mock,
  }
  if (original) {
    copyOriginalStaticProperties(namedObject[name], original)
  }
  return namedObject[name]
}

function registerCalls(args: unknown[], state: MockContext, prototypeState?: MockContext) {
  state.calls.push(args)
  prototypeState?.calls.push(args)
}

function registerInvocationOrder(order: number, state: MockContext, prototypeState?: MockContext) {
  state.invocationCallOrder.push(order)
  prototypeState?.invocationCallOrder.push(order)
}

function registerResult(result: MockResult<Procedure>, state: MockContext, prototypeState?: MockContext) {
  state.results.push(result)
  prototypeState?.results.push(result)
}

function registerSettledResult(result: MockSettledResult<Procedure>, state: MockContext, prototypeState?: MockContext) {
  state.settledResults.push(result)
  prototypeState?.settledResults.push(result)
}

function registerInstance(instance: MockReturnType<Procedure>, state: MockContext, prototypeState?: MockContext) {
  const instanceIndex = state.instances.push(instance)
  const instancePrototypeIndex = prototypeState?.instances.push(instance)
  return [instanceIndex, instancePrototypeIndex] as const
}

function registerContext(context: MockProcedureContext<Procedure>, state: MockContext, prototypeState?: MockContext) {
  const contextIndex = state.contexts.push(context)
  const contextPrototypeIndex = prototypeState?.contexts.push(context)
  return [contextIndex, contextPrototypeIndex] as const
}

function copyOriginalStaticProperties(mock: Mock, original: Procedure | Constructable) {
  const { properties, descriptors } = getAllProperties(original)

  for (const key of properties) {
    const descriptor = descriptors[key]!
    const mockDescriptor = getDescriptor(mock, key)
    if (mockDescriptor) {
      continue
    }

    Object.defineProperty(mock, key, descriptor)
  }
}

const ignoreProperties = new Set<string | symbol>([
  'length',
  'name',
  'prototype',
  Symbol.for('nodejs.util.promisify.custom'),
])

function getAllProperties(original: Procedure | Constructable) {
  const properties = new Set<string | symbol>()
  const descriptors: Record<string | symbol, PropertyDescriptor | undefined>
    = {}
  while (
    original
    && original !== Object.prototype
    && original !== Function.prototype
  ) {
    const ownProperties = [
      ...Object.getOwnPropertyNames(original),
      ...Object.getOwnPropertySymbols(original),
    ]
    for (const prop of ownProperties) {
      if (descriptors[prop] || ignoreProperties.has(prop)) {
        continue
      }
      properties.add(prop)
      descriptors[prop] = Object.getOwnPropertyDescriptor(original, prop)
    }
    original = Object.getPrototypeOf(original)
  }
  return {
    properties,
    descriptors,
  }
}

function getDefaultConfig(original?: Procedure | Constructable): MockConfig {
  return {
    mockImplementation: undefined,
    mockOriginal: original,
    mockName: 'vi.fn()',
    onceMockImplementations: [],
  }
}

function getDefaultState(): MockContext {
  const state = {
    calls: [],
    contexts: [],
    instances: [],
    invocationCallOrder: [],
    settledResults: [],
    results: [],
    get lastCall() {
      return state.calls.at(-1)
    },
  }
  return state
}

export function restoreAllMocks(): void {
  for (const restore of MOCK_RESTORE) {
    restore()
  }
  MOCK_RESTORE.clear()
}

export function clearAllMocks(): void {
  REGISTERED_MOCKS.forEach(mock => mock.mockClear())
}

export function resetAllMocks(): void {
  REGISTERED_MOCKS.forEach(mock => mock.mockReset())
}

export type {
  MaybeMocked,
  MaybeMockedConstructor,
  MaybeMockedDeep,
  MaybePartiallyMocked,
  MaybePartiallyMockedDeep,
  Mock,
  MockContext,
  Mocked,
  MockedClass,
  MockedFunction,
  MockedFunctionDeep,
  MockedObject,
  MockedObjectDeep,
  MockInstance,
  MockInstanceOption,
  MockParameters,
  MockProcedureContext,
  MockResult,
  MockResultIncomplete,
  MockResultReturn,
  MockResultThrow,
  MockReturnType,
  MockSettledResult,
  MockSettledResultFulfilled,
  MockSettledResultIncomplete,
  MockSettledResultRejected,
  PartiallyMockedFunction,
  PartiallyMockedFunctionDeep,
  PartialMock,
} from './types'
