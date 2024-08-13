export class MockerRegistry {
  private readonly registry: Map<string, MockedModule> = new Map()

  clear(): void {
    this.registry.clear()
  }

  keys(): IterableIterator<string> {
    return this.registry.keys()
  }

  set(id: string, mock: MockedModule): void {
    this.registry.set(id, mock)
  }

  public register(
    type: 'redirect',
    raw: string,
    url: string,
    redirect: string,
  ): RedirectedModule
  public register(
    type: 'manual',
    raw: string,
    url: string,
    factory: () => any,
  ): ManualMockedModule
  public register(
    type: 'automock',
    raw: string,
    url: string,
  ): AutomockedModule
  public register(
    type: 'autospy',
    raw: string,
    url: string,
  ): AutospiedModule
  public register(
    type: MockedModuleType,
    raw: string,
    url: string,
    factoryOrRedirect?: string | (() => any),
  ): MockedModule {
    if (type === 'manual') {
      if (typeof factoryOrRedirect !== 'function') {
        throw new TypeError('[vitest] Manual mocks require a factory function.')
      }
      const mock = new ManualMockedModule(raw, url, factoryOrRedirect)
      this.registry.set(url, mock)
      return mock
    }
    else if (type === 'automock' || type === 'autospy') {
      const mock = type === 'automock'
        ? new AutomockedModule(raw, url)
        : new AutospiedModule(raw, url)
      this.registry.set(url, mock)
      return mock
    }
    else if (type === 'redirect') {
      if (typeof factoryOrRedirect !== 'string') {
        throw new TypeError('[vitest] Redirect mocks require a redirect string.')
      }
      const mock = new RedirectedModule(raw, url, factoryOrRedirect)
      this.registry.set(url, mock)
      return mock
    }
    else {
      throw new Error(`[vitest] Unknown mock type: ${type}`)
    }
  }

  public delete(id: string): void {
    this.registry.delete(id)
  }

  public get(id: string): MockedModule | undefined {
    return this.registry.get(id)
  }

  public has(id: string): boolean {
    return this.registry.has(id)
  }
}

export type MockedModule =
  | AutomockedModule
  | AutospiedModule
  | ManualMockedModule
  | RedirectedModule
export type MockedModuleType = 'automock' | 'autospy' | 'manual' | 'redirect'

export type MockedModuleSerialized =
  | AutomockedModuleSerialized
  | AutospiedModuleSerialized
  | ManualMockedModuleSerialized
  | RedirectedModuleSerialized

export class AutomockedModule {
  public readonly type = 'automock'

  constructor(
    public raw: string,
    public url: string,
  ) {}

  static fromJSON(data: AutomockedModuleSerialized): AutospiedModule {
    return new AutospiedModule(data.raw, data.url)
  }

  toJSON(): AutomockedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      raw: this.raw,
    }
  }
}

export interface AutomockedModuleSerialized {
  type: 'automock'
  url: string
  raw: string
}

export class AutospiedModule {
  public readonly type = 'autospy'

  constructor(
    public raw: string,
    public url: string,
  ) {}

  static fromJSON(data: AutospiedModuleSerialized): AutospiedModule {
    return new AutospiedModule(data.raw, data.url)
  }

  toJSON(): AutospiedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      raw: this.raw,
    }
  }
}

export interface AutospiedModuleSerialized {
  type: 'autospy'
  url: string
  raw: string
}

export class RedirectedModule {
  public readonly type = 'redirect'

  constructor(
    public raw: string,
    public url: string,
    public redirect: string,
  ) {}

  static fromJSON(data: RedirectedModuleSerialized): RedirectedModule {
    return new RedirectedModule(data.raw, data.url, data.redirect)
  }

  toJSON(): RedirectedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      raw: this.raw,
      redirect: this.redirect,
    }
  }
}

export interface RedirectedModuleSerialized {
  type: 'redirect'
  url: string
  raw: string
  redirect: string
}

export class ManualMockedModule {
  public cache: Record<string | symbol, any> | undefined
  public readonly type = 'manual'

  constructor(
    public raw: string,
    public url: string,
    public factory: () => any,
  ) {}

  async resolve(): Promise<Record<string | symbol, any>> {
    if (this.cache) {
      return this.cache
    }
    let exports: any
    try {
      exports = await this.factory()
    }
    catch (err) {
      const vitestError = new Error(
        '[vitest] There was an error when mocking a module. '
        + 'If you are using "vi.mock" factory, make sure there are no top level variables inside, since this call is hoisted to top of the file. '
        + 'Read more: https://vitest.dev/api/vi.html#vi-mock',
      )
      vitestError.cause = err
      throw vitestError
    }

    if (exports === null || typeof exports !== 'object') {
      throw new TypeError(
        `[vitest] vi.mock("${this.raw}", factory?: () => unknown) is not returning an object. Did you mean to return an object with a "default" key?`,
      )
    }

    return (this.cache = exports)
  }

  static fromJSON(data: ManualMockedModuleSerialized, factory: () => any): ManualMockedModule {
    return new ManualMockedModule(data.raw, data.url, factory)
  }

  toJSON(): ManualMockedModuleSerialized {
    return {
      type: this.type,
      url: this.url,
      raw: this.raw,
    }
  }
}

export interface ManualMockedModuleSerialized {
  type: 'manual'
  url: string
  raw: string
}
