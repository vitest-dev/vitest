// @ts-expect-error virtual module
import { value } from 'virtual-module-indirect'

export function getVirtualValue() {
  return value
}
