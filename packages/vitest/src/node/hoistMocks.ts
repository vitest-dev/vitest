import MagicString from 'magic-string'
import type { CallExpression, Identifier, MemberExpression, VariableDeclaration, Node as _Node } from 'estree'
import { findNodeAround, simple as simpleWalk } from 'acorn-walk'
import { parseAstAsync } from 'vite'

export type Positioned<T> = T & {
  start: number
  end: number
}

export type Node = Positioned<_Node>

function isIdentifier(node: any): node is Positioned<Identifier> {
  return node.type === 'Identifier'
}

function isMemberExpression(node: any): node is Positioned<MemberExpression> {
  return node.type === 'MemberExpression'
}

function isValidCalleeObject(node: any): boolean {
  let name: string = ''
  if (isIdentifier(node)) {
    name = node.name
  }
  else if (isMemberExpression(node)) {
    if (isIdentifier(node.property))
      name = node.property.name
  }

  return name === 'vi' || name === 'vitest'
}

const regexpHoistable = /^[ \t]*\b(?:__vite_ssr_import_\d+__\.)?(vi|vitest)\s*\.\s*(mock|unmock|hoisted)\(/m
const regexpAssignedHoisted = /=[ \t]*(\bawait|)[ \t]*\b(?:__vite_ssr_import_\d+__\.)?(vi|vitest)\s*\.\s*hoisted\(/
const hashbangRE = /^#!.*\n/

export async function hoistMocks(code: string) {
  const hasMocks = regexpHoistable.test(code) || regexpAssignedHoisted.test(code)

  if (!hasMocks)
    return

  const s = new MagicString(code)

  const ast: any = await parseAstAsync(code)

  let hoistedCode = ''

  simpleWalk(ast, {
    CallExpression(_node) {
      const node = _node as any as Positioned<CallExpression>
      if (
        node.callee.type === 'MemberExpression'
        && isValidCalleeObject(node.callee.object)
        && isIdentifier(node.callee.property)
      ) {
        const methodName = node.callee.property.name

        if (methodName === 'mock' || methodName === 'unmock') {
          hoistedCode += `${code.slice(node.start, node.end)}\n`
          s.remove(node.start, node.end)
        }

        if (methodName === 'hoisted') {
          const declarationNode = findNodeAround(ast, node.start, 'VariableDeclaration')?.node as Positioned<VariableDeclaration> | undefined
          const init = declarationNode?.declarations[0]?.init
          const isViHoisted = (node: CallExpression) => {
            return node.callee.type === 'MemberExpression'
              && isValidCalleeObject(node.callee.object)
              && isIdentifier(node.callee.property)
              && node.callee.property.name === 'hoisted'
          }

          const canMoveDeclaration = (init
            && init.type === 'CallExpression'
            && isViHoisted(init)) /* const v = vi.hoisted() */
            || (init
                && init.type === 'AwaitExpression'
                && init.argument.type === 'CallExpression'
                && isViHoisted(init.argument)) /* const v = await vi.hoisted() */

          if (canMoveDeclaration) {
            // hoist "const variable = vi.hoisted(() => {})"
            hoistedCode += `${code.slice(declarationNode.start, declarationNode.end)}\n`
            s.remove(declarationNode.start, declarationNode.end)
          }
          else {
            // hoist "vi.hoisted(() => {})"
            hoistedCode += `${code.slice(node.start, node.end)}\n`
            s.remove(node.start, node.end)
          }
        }
      }
    },
  })

  if (hoistedCode) {
    const hoistIndex = code.match(hashbangRE)?.[0].length ?? 0

    ;(ast.body as Node[]).some((node) => {
      if (node.type === 'VariableDeclaration') {
        const content = code.substring(node.start, node.end)
        // We need to hoist the vitest
        if (content.includes('vitest/dist/index.js')) {
          s.remove(node.start, node.end)
          s.appendLeft(hoistIndex, content)
          return true
        }
      }
      return false
    })
    s.appendLeft(
      hoistIndex,
      hoistedCode,
    )
  }

  return {
    ast,
    code: s.toString(),
    map: s.generateDecodedMap({ hires: 'boundary' }),
  }
}
