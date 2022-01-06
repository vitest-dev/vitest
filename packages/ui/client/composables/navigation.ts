import type { Ref } from 'vue'
import type { File } from '#types'

const currentModuleSymbol = Symbol('current-module')

export function provideCurrentModule() {
  provide(currentModuleSymbol, ref<File | undefined>(undefined))
}

export function injectCurrentModule(): Ref<File | undefined> {
  return inject(currentModuleSymbol)!
}
