// https://github.com/nodejs/node/blob/62b2cf30f2d1326dde9d4bc047f5611f17c4a20f/lib/internal/modules/esm/assert.js

import { assertTypes } from '@vitest/utils'
import type { CreateModuleOptions, ModuleFormat } from './types'
import { capitalize, createStrictNodeError, moduleString } from './utils'

const kImplicitAssertType = 'javascript'

const formatTypeMap = {
  __proto__: null,
  builtin: kImplicitAssertType,
  commonjs: kImplicitAssertType,
  json: 'json',
  module: kImplicitAssertType,
  data: kImplicitAssertType,
  vite: kImplicitAssertType,
  wasm: kImplicitAssertType, // It's unclear whether the HTML spec will require an assertion type or not for Wasm; see https://github.com/WebAssembly/esm-integration/issues/42
}

export const supportedAssertionTypes = Object.values(formatTypeMap).filter(name => name !== kImplicitAssertType)

export function validateAssertion(
  url: string,
  format: ModuleFormat,
  options?: CreateModuleOptions,
) {
  const assertions = options?.assert || {}
  const validType = formatTypeMap[format]
  if (validType === undefined)
    return true

  if (validType === kImplicitAssertType) {
    if (!('type' in assertions))
      return true
    return handleInvalidType(url, options?.$_referencer, assertions.type)
  }

  // valid type
  if (validType === assertions.type)
    return true

  if (!('type' in assertions)) {
    throw createStrictNodeError(
      `Cannot import ${moduleString(url, options?.$_referencer)} without specifying \`assert: { type: "${validType}" }\`.`,
      'VITEST_ERR_IMPORT_ASSERTION_TYPE_MISSING',
    )
  }

  return handleInvalidType(url, options?.$_referencer, assertions.type)
}

const supportedTypesMessage = `Node.js supports only these explicit types: ${supportedAssertionTypes.join(', ')}.`

function handleInvalidType(url: string, referencer: string | undefined, type: string) {
  assertTypes(type, 'type', ['string'])

  let typesMessage = supportedTypesMessage
  if (type === kImplicitAssertType)
    typesMessage += ` You should omit the "type" option to use the default type for this file format since HTML spec forbids explicit usage of "${kImplicitAssertType}" type.`

  if (!supportedAssertionTypes.includes(type)) {
    throw createStrictNodeError(
      `Type "${type}" on ${moduleString(url, referencer)} is not supported in Node.js. ${typesMessage}`,
      'VITEST_ERR_IMPORT_ASSERTION_TYPE_UNSUPPORTED',
    )
  }

  throw createStrictNodeError(
    `${capitalize(moduleString(url, referencer))} is not of type "${type}". ${typesMessage}`,
    'VITEST_ERR_IMPORT_ASSERTION_TYPE_FAILED',
  )
}
