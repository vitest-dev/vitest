import { mockedA } from './mockedA'

export class MockedC {
  public value: number

  constructor() {
    this.value = 42
  }

  public doSomething() {
    return mockedA()
  }

  get getOnlyProp(): number {
    return 42
  }

  get getSetProp(): number {
    return 123
  }

  set getSetProp(_val: number) {}

  get getExpectNotCalled(): number {
    throw new Error('automocked constructor should not call this getter')
  }
}

export async function asyncFunc(): Promise<string> {
  await new Promise<void>(resolve => resolve())
  return '1234'
}

// This is here because mocking streams previously caused some problems (#1671).
export const exportedStream = process.stderr
