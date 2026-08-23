/**
 * Resolve the `oxc` options Vitest merges into the user's Vite config.
 *
 * Only defaults the target. A user-provided target must not be restated here:
 * Vite merges a plugin's returned config into the user's config with
 * `mergeConfig`, which concatenates arrays — so re-stating an array target
 * would duplicate its entries, and OXC rejects duplicates.
 */
export function resolveOxcOptions(
  oxc: { target?: string | string[] } | false | undefined,
): { target?: string | string[] } | false {
  if (oxc === false) {
    return false
  }
  return oxc?.target ? {} : { target: 'node18' }
}

/**
 * Resolve the `esbuild` options Vitest merges into the user's Vite config.
 *
 * As with `resolveOxcOptions`, a user-provided `target` is left out of the
 * returned partial config so the merge cannot concatenate it into duplicates.
 */
export function resolveEsbuildOptions(
  esbuild: { target?: string | string[] } | false | undefined,
): { target?: string; sourcemap: 'external'; legalComments: 'inline' } | false {
  if (esbuild === false) {
    return false
  }
  return {
    // Lowest target Vitest supports is Node18
    ...(!esbuild?.target ? { target: 'node18' } : {}),
    sourcemap: 'external',
    // Enables using ignore hint for coverage providers with @preserve keyword
    legalComments: 'inline',
  }
}
