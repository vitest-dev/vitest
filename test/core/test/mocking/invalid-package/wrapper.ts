// @ts-expect-error no type
import * as dep from '@vitest/test-dep-invalid'

export const hello = () => dep
