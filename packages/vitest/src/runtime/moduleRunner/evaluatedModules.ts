import type { VitestFetchResult } from '../../types/general'
import { DecodedMap } from '@vitest/utils/source-map'
import { dirname, resolve } from 'pathe'
import { EvaluatedModules } from 'vite/module-runner'

export class VitestEvaluatedModules extends EvaluatedModules {
  getModuleSourceMapById(id: string): any {
    const mod = this.getModuleById(id)
    const sourceMap = (mod?.meta as VitestFetchResult | undefined)?.sourceMap
    if (mod && sourceMap) {
      mod.map ??= new DecodedMap(JSON.parse(sourceMap), mod.file)
      return mod.map
    }

    // TODO: this is not needed in Vite 7.2+
    /** the return type is not exposed by Vite */
    const map = super.getModuleSourceMapById(id)
    if (map != null && !('_patched' in map)) {
      ;(map as any)._patched = true
      const dir = dirname(map.url)
      map.resolvedSources = (map.map.sources || []).map((s) => resolve(dir, s || ''))
    }
    return map
  }
}
