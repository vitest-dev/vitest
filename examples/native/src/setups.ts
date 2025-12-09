let jsSetup = false
let tsSetup = false

export function initJsSetup() {
  jsSetup = true
}

export function initTsSetup() {
  tsSetup = true
}

export function getSetupStates() {
  return {
    jsSetup,
    tsSetup,
  }
}
