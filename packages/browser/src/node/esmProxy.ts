import MagicString from 'magic-string'
import type { PluginContext } from 'rollup'
import type { Expression } from 'estree'
import { isAbsolute } from 'pathe'
import type { Positioned } from './esmWalker'
import { esmWalker } from './esmWalker'

// filter this out so getImporter() picks the right index
const skipImports = [
  '^vitest$',
  '^@vitest/',
]

export async function insertEsmProxy(
  code: string,
  id: string,
  parse: PluginContext['parse'],
  rollupResolve: PluginContext['resolve'],
) {
  const s = new MagicString(code)

  let ast: any
  try {
    ast = parse(code)
  }
  catch (err) {
    console.error(`Cannot parse ${id}:\n${(err as any).message}`)
    return
  }

  const importsToResolve = new Set<string>()

  // find all literal imports so we can resolve them in an async step before re-running the sync walker
  esmWalker(ast, {
    onDynamicImport(node) {
      const expression = (node.source as Positioned<Expression>)
      if (!(expression.type === 'Literal' && typeof expression.value === 'string'))
        return

      const { value } = expression
      if (skipImports.some(i => value.match(i)))
        return

      importsToResolve.add(value)
    },
    onIdentifier() {},
    onImportMeta() {},
  })

  // resolve all imports in an async step
  const resolveToId = async (importName: string) => {
    const out = await rollupResolve(importName, id)
    if (!out?.id)
      return undefined
    const resolved = out.id

    if (!isAbsolute(resolved))
      return undefined

    return `/@fs${resolved}`
  }

  const resolvedImports = Object.fromEntries(
    await Promise.all([...importsToResolve].map(
      async (importName): Promise<[string, string | undefined]> => {
        return [importName, await resolveToId(importName)]
      },
    )),
  )

  // insert matched imports with the import rewrite
  esmWalker(ast, {
    onDynamicImport(node) {
      const expression = (node.source as Positioned<Expression>)
      if (!(expression.type === 'Literal' && typeof expression.value === 'string')) {
        // this is import(not-a-literal), ignore: can't mock this for now
        return
      }

      const { value } = expression
      const resolved = resolvedImports[value]
      if (!resolved)
        return

      s.overwrite(node.start, node.end, `__vitest_mocker__.import(${JSON.stringify(resolved)}, ${JSON.stringify(value)}, import.meta.url)`)
    },
    onIdentifier() {},
    onImportMeta() {},
  })

  return {
    ast,
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: id }),
  }
}
