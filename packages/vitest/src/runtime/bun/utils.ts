export declare class ShadowRealm {
  constructor()
  importValue(specifier: string, bindingName: string): Promise<unknown>
  evaluate(sourceText: string): unknown
}

export interface ShadowRealmOnCallback {
  (fn: (data: string) => void): void
}

export interface ShadowRealmSendCallback {
  (data: string): void
}

export function createShadowRealm() {
  if (typeof ShadowRealm === 'undefined')
    throw new Error('Current environment does not support ShadowRealm. Please, use "bun" instead.')
  return new ShadowRealm()
}
