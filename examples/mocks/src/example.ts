export function square(a: number, b: number) {
  return a * b
}
export async function asyncSquare(a: number, b: number) {
  const result = (await a) * b
  return result
}
export const someClasses = new (class Bar {
  public array: number[]
  constructor() {
    this.array = [1, 2, 3]
  }

  foo() {}
})()
export const object = {
  baz: 'foo',
  bar: {
    fiz: 1,
    buzz: [1, 2, 3],
  },
}
export const array = [1, 2, 3]
export const number = 123
export const string = 'baz'
export const boolean = true
export const symbol = Symbol.for('a.b.c')
export default 'a default'
