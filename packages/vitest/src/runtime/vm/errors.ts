// https://github.com/nodejs/node/blob/62b2cf30f2d1326dde9d4bc047f5611f17c4a20f/lib/internal/errors.js

export default {
  VITEST_ERR_IMPORT_ASSERTION_TYPE_MISSING: 'ERR_IMPORT_ASSERTION_TYPE_MISSING', // An import assertion is missing, preventing the specified module to be imported
  VITEST_ERR_IMPORT_ASSERTION_TYPE_UNSUPPORTED: 'ERR_IMPORT_ASSERTION_TYPE_UNSUPPORTED', // An import assertion is not supported by this version of Node.js
  VITEST_ERR_IMPORT_ASSERTION_TYPE_FAILED: 'ERR_IMPORT_ASSERTION_TYPE_FAILED', // An import assertion has failed, preventing the specified module to be imported

  // TODO
  VITEST_ERR_UNKNOWN_BUILTIN_MODULE: 'ERR_UNKNOWN_BUILTIN_MODULE', // Importing with node: but module is not found
  VITEST_ERR_REQUIRE_ESM: 'ERR_REQUIRE_ESM', // An attempt was made to require() an ES Module.
  // this might be resolved by import.meta.resolve
  VITEST_ERR_UNKNOWN_FILE_EXTENSION: 'ERR_UNKNOWN_FILE_EXTENSION', // An attempt was made to load a module with an unknown or unsupported file extension
  VITEST_ERR_UNKNOWN_MODULE_FORMAT: 'ERR_UNKNOWN_MODULE_FORMAT', // An attempt was made to load a module with an unknown or unsupported format
  VITEST_ERR_UNSUPPORTED_DIR_IMPORT: 'ERR_UNSUPPORTED_DIR_IMPORT', // import a directory URL is unsupported
  VITEST_ERR_UNSUPPORTED_ESM_URL_SCHEME: 'ERR_UNSUPPORTED_ESM_URL_SCHEME', // import with URL schemes other than file and data is unsupported.
}
