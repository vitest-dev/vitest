// @ts-expect-error no type
import * as dep from 'test-dep-invalid'

export const hello = () => dep
