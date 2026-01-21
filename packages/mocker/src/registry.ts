export class MockerRegistry {
  private readonly registryByUrl: Map<string, MockedModule> = new Map()
  private readonly registryById: Map<string, MockedModule> = new Map()

  clear(): void {
    this.registryByUrl.clear()
    this.registryById.clear()
  }

  keys(): IterableIterator<string> {
    return this.registryByUrl.keys()
  }

  add(mock: MockedModule): void {
    this.registryByUrl.set(mock.url, mock)
    this.registryById.set(mock.id, mock)
  }

  public register(
    json: MockedModuleSerialized,
  ): MockedModule
  public register(
    type: 'redirect',
    raw: string,
    id: string,
    url: string,
    redirect: string,
  ): RedirectedModule
  public register(
    type: 'manual',
    raw: string,
    id: string,
    url: string,
    factory: () => any,
  ): ManualMockedModule
  public register(
    type: 'automock',
    raw: string,
    id: string,
    url: string,
  ): AutomockedModule
  public register(
    type: 'autospy',
    id: string,
    raw: string,
    url: string,
  ): AutospiedModule
  public register(
    typeOrEvent: MockedModuleType | MockedModuleSerialized,
    raw?: string,
    id?: string,
    url?: string,
    factoryOrRedirect?: string | (() => any),
  ): MockedModule {
    const type = typeof typeOrEvent === 'object' ? typeOrEvent.type : typeOrEvent

    if (typeof typeOrEvent === 'object') {
      const event = typeOrEvent
      if (
        event instanceof AutomockedModule
        || event instanceof AutospiedModule
        || event instanceof ManualMockedModule
        || event instanceof RedirectedModule
      ) {
        throw new TypeError(
          `[vitest] Cannot register a mock that is already defined. `
          + `Expected a JSON representation from \`MockedModule.toJSON\`, instead got "${event.type}". `
          + `Use "registry.add()" to update a mock instead.`,
        )
      }
      if (event.type === 'automock') {
        const module = AutomockedModule.fromJSON(event)
        this.add(module)
        return module
      }
      else if (event.type === 'autospy') {
        const module = AutospiedModule.fromJSON(event)
        this.add(module)
        return module
      }
      else if (event.type === 'redirect') {
        const module = RedirectedModule.fromJSON(event)
        this.add(module)
        return module
      }
      else if (event.type === 'manual') {
        throw new Error(`Cannot set serialized manual mock. Define a factory function manually with \`ManualMockedModule.fromJSON()\`.`)
      }
      else {
        throw new Error(`Unknown mock type: ${(event as any).type}`)
      }
    }

    if (typeof raw !== 'string') {
      throw new TypeError('[vitest] Mocks require a raw string.')
    }

    if (typeof url !== 'string') {
      throw new TypeError('[vitest] Mocks require a url string.')
    }

    if (typeof id !== 'string') {
      throw new TypeError('[vitest] Mocks require an id string.')
    }

    if (type === 'manual') {
      if (typeof factoryOrRedirect !== 'function') {
        throw new TypeError('[vitest] Manual mocks require a factory function.')
      }
      const mock = new ManualMockedModule(raw, id, url, factoryOrRedirect)
      this.add(mock)
      return mock
    }
    else if (type === 'automock' || type === 'autospy') {
      const mock = type === 'automock'
        ? new AutomockedModule(raw, id, url)
        : new AutospiedModule(raw, id, url)
      this.add(mock)
      return mock
    }
    else if (type === 'redirect') {
      if (typeof factoryOrRedirect !== 'string') {
        throw new TypeError('[vitest] Redirect mocks require a redirect string.')
      }
      const mock = new RedirectedModule(raw, id, url, factoryOrRedirect)
      this.add(mock)
      return mock
    }
    else {
      throw new Error(`[vitest] Unknown mock type: ${type}`)
    }
  }

  public delete(id: string): void {
    this.registryByUrl.delete(id)
  }

  public deleteById(id: string): void {
    this.registryById.delete(id)
  }

  public get(id: string): MockedModule | undefined {
    return this.registryByUrl.get(id)
  }

  public getById(id: string): MockedModule | undefined {
    return this.registryById.get(id)
  }

  public has(id: string): boolean {
    return this.registryByUrl.has(id)
  }
}

export type MockedModule
  = | AutomockedModule
    | AutospiedModule
    | ManualMockedModule
    | RedirectedModule
export type MockedModuleType = 'automock' | 'autospy' | 'manual' | 'redirect'

export type MockedModuleSerialized
  = | AutomockedModuleSerialized
    | AutospiedModuleSerialized
    | ManualMockedModuleSerialized
    | RedirectedModuleSerialized

export class AutomockedModule {
  public readonly type = 'automock'

  constructor(
    public raw: string,
    public id: string,
    public url: string,
  ) {}

  static fromJSON(data: AutomockedModuleSerialized): AutospiedModule {
    return new AutospiedModule(data.raw, data.id, data.url)
  }

  toJSON(): AutomockedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      raw: this.raw,
      id: this.id,
    }
  }
}

export interface AutomockedModuleSerialized {
  type: 'automock'
  url: string
  raw: string
  id: string
}

export class AutospiedModule {
  public readonly type = 'autospy'

  constructor(
    public raw: string,
    public id: string,
    public url: string,
  ) {}

  static fromJSON(data: AutospiedModuleSerialized): AutospiedModule {
    return new AutospiedModule(data.raw, data.id, data.url)
  }

  toJSON(): AutospiedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      id: this.id,
      raw: this.raw,
    }
  }
}

export interface AutospiedModuleSerialized {
  type: 'autospy'
  url: string
  raw: string
  id: string
}

export class RedirectedModule {
  public readonly type = 'redirect'

  constructor(
    public raw: string,
    public id: string,
    public url: string,
    public redirect: string,
  ) {}

  static fromJSON(data: RedirectedModuleSerialized): RedirectedModule {
    return new RedirectedModule(data.raw, data.id, data.url, data.redirect)
  }

  toJSON(): RedirectedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      raw: this.raw,
      id: this.id,
      redirect: this.redirect,
    }
  }
}

export interface RedirectedModuleSerialized {
  type: 'redirect'
  url: string
  id: string
  raw: string
  redirect: string
}

export class ManualMockedModule<T = any> {
  public cache: T | undefined
  public readonly type = 'manual'

  constructor(
    public raw: string,
    public id: string,
    public url: string,
    public factory: () => T,
  ) {}

  resolve(): T {
    if (this.cache) {
      return this.cache
    }
    let exports: any
    try {
      exports = this.factory()
    }
    catch (err: any) {
      throw createHelpfulError(err)
    }

    if (typeof exports === 'object' && typeof exports?.then === 'function') {
      return exports.then(
        (result: T) => {
          assertValidExports(this.raw, result)
          return (this.cache = result)
        },
        (error: any) => {
          throw createHelpfulError(error)
        },
      )
    }

    assertValidExports(this.raw, exports)

    return (this.cache = exports)
  }

  static fromJSON(data: ManualMockedModuleSerialized, factory: () => any): ManualMockedModule {
    return new ManualMockedModule(data.raw, data.id, data.url, factory)
  }

  toJSON(): ManualMockedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      id: this.id,
      raw: this.raw,
    }
  }
}

function createHelpfulError(cause: Error) {
  const error = new Error(
    '[vitest] There was an error when mocking a module. '
    + 'If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. '
    + 'Read more: https://vitest.dev/api/vi.html#vi-mock',
  )
  error.cause = cause
  return error
}

function assertValidExports(raw: string, exports: any) {
  if (exports === null || typeof exports !== 'object' || Array.isArray(exports)) {
    throw new TypeError(
      `[vitest] vi.mock("${raw}", factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?`,
    )
  }
}

export interface ManualMockedModuleSerialized {
  type: 'manual'
  url: string
  id: string
  raw: string
}
