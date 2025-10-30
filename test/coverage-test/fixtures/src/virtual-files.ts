// @ts-expect-error -- untyped virtual file provided by custom plugin
import virtualFile1 from 'virtual:vitest-custom-virtual-file-1'

// @ts-expect-error -- untyped virtual file provided by custom plugin
import virtualFile2 from '\0vitest-custom-virtual-file-2'

// @ts-expect-error -- untyped virtual file provided by custom plugin
import * as virtualMath from 'vitest-custom-virtual:math'

export function getVirtualFileImports() {
  return { virtualFile1, virtualFile2, virtualMath }
}
