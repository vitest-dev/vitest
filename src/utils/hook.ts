export function createHook<T extends any[]>() {
  const stacks: ((...args: T) => void | Promise<void>)[] = []
  return {
    on(fn: (...args: T) => void | Promise<void>) {
      stacks.push(fn)
    },
    async fire(...args: T) {
      await Promise.all(stacks.map(async fn => await fn(...args)))
    },
    clear() {
      stacks.length = 0
    },
  }
}
