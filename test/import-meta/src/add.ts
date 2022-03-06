export function add(...args: number[]) {
  if (!args.length)
    return 0
  if (args.length === 1)
    return args[0]
  return args.reduce((a, b) => a + b)
}

if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest
  it('add', () => {
    expect(add()).toBe(0)
    expect(add(1)).toBe(1)
    expect(add(1, 2, 3)).toBe(6)
  })
}
