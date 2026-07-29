// @ts-expect-error -- types not picked up for some reason
import cjsDefault from '@vitest/cjs-lib'

export default function getA() {
  return cjsDefault.a
}
