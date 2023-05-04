import { version as VERSION } from '../package.json'

export function getVersion(): string {
  // @ts-expect-error internal variable
  return globalThis.__vitest_runner_version__ || VERSION
}

export function markVersion(): void {
  // @ts-expect-error internal variable
  globalThis.__vitest_runner_version__ = VERSION
}

export function checkVersion() {
  const collectVersion = getVersion()

  if (collectVersion !== VERSION) {
    const error = `Version mismatch: Vitest started as ${collectVersion}, but tests are collected with ${VERSION} version.`
      + '\n\n- If you are using global Vitest, make sure your package has the same version.'
      + '\n- If you have a monorepo setup, make sure your main package has the same version as your test packages.'
    throw new Error(error)
  }
}
