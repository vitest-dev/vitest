import { leak } from './leak'

export function consumer() {
  return leak()
}
