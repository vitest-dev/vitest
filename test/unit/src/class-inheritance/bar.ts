import { Foo } from './foo.js'

export class Bar extends Foo {
  override doSomething(): boolean {
    return true
  }

  doSomethingElse(): boolean {
    return true
  }
}
