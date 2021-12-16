// TODO: remove this file after https://github.com/unjs/mlly/pull/27

import { promises as fsp } from 'fs'
import { extname } from 'pathe'
import { readPackageJSON } from 'pkg-types'
import { isNodeBuiltin, resolvePath, hasCJSSyntax } from 'mlly'
import type { ResolveOptions } from 'mlly'

// 2+ letters, to exclude Windows drive letters
const ProtocolRegex = /^(?<proto>.{2,}):.+$/

export function getProtocol(id: string): string | null {
  const proto = id.match(ProtocolRegex)
  return proto ? proto.groups!.proto : null
}

const ESM_RE = /([\s;]|^)(import[\w,{}\s*]*from|import\s*['"*{]|export\b\s*(?:[*{]|default|type|function|const|var|let|async function)|import\.meta\b)/m

const BUILTIN_EXTENSIONS = new Set(['.mjs', '.cjs', '.node', '.wasm'])

export function hasESMSyntax(code: string): boolean {
  return ESM_RE.test(code)
}

export interface ValidNodeImportOptions extends ResolveOptions {
  /**
   * The contents of the import, which may be analyzed to see if it contains
   * CJS or ESM syntax as a last step in checking whether it is a valid import.
   */
  code?: string
  /**
   * Protocols that are allowed as valid node imports.
   *
   * Default: ['node', 'file', 'data']
   */
  allowedProtocols?: Array<string>
}

const validNodeImportDefaults: ValidNodeImportOptions = {
  allowedProtocols: ['node', 'file', 'data'],
}

export async function isValidNodeImport(id: string, _opts: ValidNodeImportOptions = {}): Promise<boolean> {
  if (isNodeBuiltin(id))
    return true

  const opts = { ...validNodeImportDefaults, ..._opts }

  const proto = getProtocol(id)
  if (proto && !opts.allowedProtocols?.includes(proto))
    return false

  // node is already validated by isNodeBuiltin and file will be normalized by resolvePath
  if (proto === 'data')
    return true

  const resolvedPath = await resolvePath(id, opts)
  const extension = extname(resolvedPath)

  if (BUILTIN_EXTENSIONS.has(extension))
    return true

  if (extension !== '.js')
    return false

  if (resolvedPath.match(/\.(\w+-)?esm?(-\w+)?\.js$/))
    return false

  const pkg = await readPackageJSON(resolvedPath).catch(() => null)
  if (pkg?.type === 'module') return true

  const code = opts.code || await fsp.readFile(resolvedPath, 'utf-8').catch(() => null) || ''

  return hasCJSSyntax(code) || !hasESMSyntax(code)
}
