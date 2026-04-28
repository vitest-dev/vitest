import { vi } from 'vitest'

let jsSetup = false
let tsSetup = false

export const initJsSetup = vi.fn(() => {
  jsSetup = true
})

export const initTsSetup = vi.fn(() => {
  tsSetup = true
})

export function getSetupStates() {
  return {
    jsSetup,
    tsSetup,
  }
}
