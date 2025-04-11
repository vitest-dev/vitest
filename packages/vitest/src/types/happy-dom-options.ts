import type { happyDomTypes } from 'vitest/optional-types.js'

export type HappyDOMOptions = Omit<
  NonNullable<ConstructorParameters<typeof happyDomTypes.Window>[0]>,
  'console'
>
