// eslint-disable-next-line ts/ban-ts-comment
// @ts-ignore `happy-dom` is optional peeer dep
import type { Window } from 'happy-dom'

export type HappyDOMOptions = Omit<
  NonNullable<ConstructorParameters<typeof Window>[0]>,
  'console'
>
