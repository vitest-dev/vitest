import { CalledB } from './circularA'

export function circularB() {
  return CalledB.push(CalledB.length)
}
