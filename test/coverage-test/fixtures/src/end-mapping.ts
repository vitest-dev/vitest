import { useThing } from './end-mapping-dependency'

export function greet() {
  const { label } = useThing()
  return `Hello ${label}`
}
