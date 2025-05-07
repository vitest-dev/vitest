interface Getter<T> {
  get: <K extends keyof T>(key: K) => T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : T[K]
}

interface AsyncGetter<T> {
  get: <K extends keyof T>(key: K) => Promise<T[K] extends (...args: any[]) => any ? ReturnType<T[K]> : T[K]>
}

type ObjectValue<T> = T extends (...args: any[]) => any ? ReturnType<T> : T

type TypedObject<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends (args: infer A) => any
    ? A extends { get: any }
      ? (args: AsyncGetter<Pick<T, Exclude<keyof T, K>>>) => Promise<ObjectValue<T[K]>>
      : () => ObjectValue<T[K]>
    : T[K]
}

export function createTypedObject<T extends Record<string, any>>(obj: TypedObject<T>): T {
  return obj as T
}

// Example usage:
const _example = createTypedObject({
  key: () => true as const,
  otherKey: async ({ get }) => {
    const res = await get('key')
    // res is typed as "true"
    return res as true
  },
})
