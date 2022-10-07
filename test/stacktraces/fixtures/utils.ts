export function add(...args: number[]) {
  return args.reduce((a, b) => { return a + b }, 0)
}
