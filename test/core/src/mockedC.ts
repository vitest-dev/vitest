import { mockedA } from './mockedA'

export class MockedC {
  public value: number

  constructor() {
    this.value = 42
  }

  public doSomething() {
    return mockedA()
  }

  get getSetProp(): number {
    return 123
  }

  set getSetProp(_val: number) {}
}

export async function asyncFunc(): Promise<string> {
  await new Promise<void>(resolve => resolve())
  return '1234'
}
