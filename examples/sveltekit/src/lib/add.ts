import { dev } from '$app/environment'

export function add(a: number, b: number) {
  if (dev) {
    console.warn(`Adding ${a} and ${b}`)
  }

  return a + b
}
