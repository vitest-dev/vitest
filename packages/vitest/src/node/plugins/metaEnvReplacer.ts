import type { Plugin } from 'vite'
import { cleanUrl } from '@vitest/utils/helpers'
import { ancestor as walkAst } from 'acorn-walk'
import MagicString from 'magic-string'
import { parseAst } from 'vite'

const metaEnvAccessor = `Object.assign(/* istanbul ignore next */ globalThis.__vitest_worker__?.metaEnv ?? import.meta.env)`

function isImportMetaEnv(node: any): boolean {
  return node?.type === 'MemberExpression'
    && !node.computed
    && node.property?.type === 'Identifier'
    && node.property.name === 'env'
    && node.object?.type === 'MetaProperty'
    && node.object.meta?.name === 'import'
    && node.object.property?.name === 'meta'
}

function getMetaEnvAssignmentExpression(rightSide: string): string {
  return `void 0, ((__vitest_meta_env__, __vitest_env_value__) => { if (__vitest_env_value__ && typeof __vitest_env_value__ === 'object') { Object.assign(__vitest_meta_env__, __vitest_env_value__) } return __vitest_meta_env__ })(/* istanbul ignore next */ globalThis.__vitest_worker__?.metaEnv ?? import.meta.env, ${rightSide})`
}

// Rewrite import.meta.env access so property writes keep mutating the worker env proxy.
// Direct `import.meta.env = ...` assignments are handled as their own AST case.
export function MetaEnvReplacerPlugin(): Plugin {
  return {
    name: 'vitest:meta-env-replacer',
    enforce: 'pre',
    transform(code, id) {
      if (!/\bimport\.meta\.env\b/.test(code)) {
        return null
      }

      let s: MagicString | null = null
      const ast = parseAst(code)
      const assignmentRanges: Array<{ start: number; end: number }> = []

      walkAst(ast as any, {
        MemberExpression(node, ancestors) {
          if (!isImportMetaEnv(node)) {
            return
          }

          const parent = ancestors[ancestors.length - 2] as any

          if (
            parent?.type === 'AssignmentExpression'
            && parent.operator === '='
            && parent.left === node
          ) {
            s ||= new MagicString(code)
            assignmentRanges.push({
              start: parent.start,
              end: parent.end,
            })
            s.overwrite(
              parent.start,
              parent.end,
              getMetaEnvAssignmentExpression(code.slice(parent.right.start, parent.right.end)),
            )
            return
          }

          if (assignmentRanges.some(range => node.start >= range.start && node.end <= range.end)) {
            return
          }

          s ||= new MagicString(code)
          s.overwrite(
            node.start,
            node.end,
            metaEnvAccessor,
          )
        },
      })

      if (s) {
        return {
          code: s.toString(),
          map: s.generateMap({
            hires: 'boundary',

            // Remove possible query parameters, e.g. vue's "?vue&type=script&src=true&lang.ts"
            source: cleanUrl(id),
          }),
        }
      }
    },
  }
}
