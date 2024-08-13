export class MockerRegistry {
  private readonly registry: Map<string, MockedModule> = new Map()

  clear(): void {
    this.registry.clear()
  }

  keys(): IterableIterator<string> {
    return this.registry.keys()
  }

  public register(
    type: 'redirect',
    raw: string,
    url: string,
    redirect: string,
  ): void
  public register(
    type: 'manual',
    raw: string,
    url: string,
    factory: () => any,
  ): void
  public register(
    type: 'automock' | 'autospy',
    raw: string,
    url: string,
  ): void
  public register(
    type: MockedModuleType,
    raw: string,
    url: string,
    factoryOrRedirect?: string | (() => any),
  ): void {
    if (type === 'manual') {
      if (typeof factoryOrRedirect !== 'function') {
        throw new TypeError('[vitest] Manual mocks require a factory function.')
      }
      const mock = new ManualMockedModule(raw, url, factoryOrRedirect)
      this.registry.set(url, mock)
    }
    else if (type === 'automock' || type === 'autospy') {
      const mock = type === 'automock'
        ? new AutomockedModule(raw, url)
        : new AutospiedModule(raw, url)
      this.registry.set(url, mock)
    }
    else if (type === 'redirect') {
      if (typeof factoryOrRedirect !== 'string') {
        throw new TypeError('[vitest] Redirect mocks require a redirect string.')
      }
      const mock = new RedirectedModule(raw, url, factoryOrRedirect)
      this.registry.set(url, mock)
    }
    else {
      throw new Error(`Unknown mock type: ${type}`)
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

export type MockedModule = AutomockedModule | AutospiedModule | ManualMockedModule | RedirectedModule
export type MockedModuleType = 'automock' | 'autospy' | 'manual' | 'redirect'

export class AutomockedModule {
  public readonly type = 'automock'

  constructor(
    public raw: string,
    public url: string,
  ) {}
}

export class AutospiedModule {
  public readonly type = 'autospy'

  constructor(
    public raw: string,
    public url: string,
  ) {}
}

export class RedirectedModule {
  public readonly type = 'redirect'

  constructor(
    public raw: string,
    public url: string,
    public redirect: string,
  ) {}
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
}
