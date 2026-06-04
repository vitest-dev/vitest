import { circularB } from './circularB'

export const CalledB: number[] = []

export function circularA() {
  return circularB()
}
