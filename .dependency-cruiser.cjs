const { globSync, readFileSync } = require('node:fs')
const path = require('node:path')

const toPosixPath = path.sep === '/' ? x => x : x => x.replaceAll(path.sep, '/')
const escapeRegex = value => value.replace(/[|/\\{}()[\]^$+?.*]/g, '\\$&')
const valuesRec = value => typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(valuesRec)

function expandPackageEntry(packageRoot, entry) {
  if (/\/\.\.?(?:$|\/)/.test(entry)) {
    throw new Error(`Invalid entry "${entry}" in package "${packageRoot}". Entries must not contain "." or ".." segments.`)
  }
  return `^${escapeRegex(path.posix.join(packageRoot, entry)).replace('\\*', '.*')}$`
}

function expandFacadeDeclarationEntry(packageRoot, entry) {
  if (!entry.endsWith('.d.ts')) {
    return []
  }

  const facadePath = path.join(__dirname, packageRoot, entry)
  const facadeSource = readFileSync(facadePath, 'utf8')
  return Array.from(new Set(
    facadeSource.matchAll(/from ['"](\.\/dist\/[^'"]+)\.js['"]/g)
      .map(([, target]) => expandPackageEntry(packageRoot, `${target}.d.ts`)),
  ))
}

const publicFiles = globSync('packages/*/package.json', { cwd: __dirname }).flatMap((packageJsonPath) => {
  const packageRoot = toPosixPath(path.dirname(packageJsonPath))
  const packageJson = require(path.join(__dirname, packageJsonPath))
  return Array.from(new Set(valuesRec(packageJson.exports))).flatMap(target => [
    expandPackageEntry(packageRoot, target),
    ...expandFacadeDeclarationEntry(packageRoot, target),
  ])
})

const orphanPathIgnorePatterns = Array.from(new Set([
  ...publicFiles,
  expandPackageEntry('packages/ui', 'dist/client/assets/*'),
  expandPackageEntry('packages/browser', 'dist/client/__vitest__/assets/*'),
])).sort()

const distPaths = ['^packages/[^/]+/dist/.*[.](?:js|d[.]ts)$']

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-unresolved-in-dist',
      comment:
        'This module in dist depends on a module that can\'t be resolved. Either fix the dependency or - if it\'s a '
        + 'false positive - add an exception for it in your dependency-cruiser configuration.',
      severity: 'error',
      from: { path: distPaths },
      to: {
        couldNotResolve: true,
      },
    },
    {
      name: 'no-npm-dev-or-unknown-in-dist',
      comment:
        'This module in dist depends on a module that is either an npm devDependency or an npm dependency that\'s not in the package.json.\n'
        + 'Either add the dependency to your package.json or - if it\'s a false positive - add an exception for it in your dependency-cruiser configuration.',
      severity: 'error',
      from: { path: distPaths },
      to: {
        couldNotResolve: false,
        ancestor: false,
        dependencyTypesNot: [
          'core',
          'local',
          'localmodule',
          'deprecated',
          'npm',
          'npm-optional',
          'npm-peer',
          'undetermined',
        ],
      },
    },
    {
      name: 'no-sharp-import-in-dist',
      comment:
        'This module in dist depends on an internal module defined in imports field of a package.json. These are meant for use by the package itself and not for external consumption. Either change the dependency to point to a module that\'s meant for external consumption or - if it\'s a false positive - add an exception for it in your dependency-cruiser configuration.',
      severity: 'error',
      from: { path: distPaths },
      to: {
        couldNotResolve: false,
        path: ['^#'],
      },
    },
    {
      name: 'no-ancestor-npm-in-dist',
      comment:
        'This module in dist depends on a module that is either an npm devDependency or an npm dependency that\'s not in the package.json.\n'
        + 'Either add the dependency to your package.json or - if it\'s a false positive - add an exception for it in your dependency-cruiser configuration.',
      severity: 'error',
      from: { path: distPaths },
      to: {
        couldNotResolve: false,
        ancestor: true,
        dependencyTypesNot: [
          'local',
          'localmodule',
          'aliased',
        ],
      },
    },
    {
      name: 'no-circular-in-dist',
      severity: 'error',
      comment:
        'This dependency in dist is part of a circular relationship. You might want to revise '
        + 'your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ',
      from: { path: distPaths },
      to: {
        circular: true,
        viaOnly: {
          dependencyTypesNot: ['type-only', 'dynamic-import'],
        },
      },
    },
    {
      name: 'no-orphans-in-dist',
      comment:
        'This is an orphan module - it\'s likely not used (anymore?). Either use it or '
        + 'remove it. If it\'s logical this module is an orphan (i.e. it\'s a config file), '
        + 'add an exception for it in your dependency-cruiser configuration.',
      severity: 'warn',
      from: {
        orphan: true,
        path: distPaths,
        pathNot: [
          ...orphanPathIgnorePatterns,
          '^packages/browser/dist/state[.]js$', // packages/browser/src/node/projectParent.ts
          '^packages/browser/dist/client/esm-client-injector[.]js$', // packages/browser/src/node/projectParent.ts
        ],
      },
      to: {},
    },
    {
      name: 'not-to-deprecated-in-dist',
      comment:
        'This module uses a (version of an) npm module that has been deprecated. Either upgrade to a later '
        + 'version of that module, or find an alternative. Deprecated modules are a security risk.',
      severity: 'warn',
      from: { path: distPaths },
      to: {
        dependencyTypes: [
          'deprecated',
        ],
      },
    },
    {
      name: 'no-undetermined-in-dist',
      comment:
        'This module has an undetermined dependency. Check your configuration or the module itself.',
      severity: 'warn',
      from: { path: distPaths },
      to: {
        dependencyTypes: [
          'undetermined',
        ],
      },

    },
  ],
  options: {
    // Which modules not to follow further when encountered
    doNotFollow: {
      // path: an array of regular expressions in strings to match against
      path: ['node_modules'],
    },

    // Which modules to exclude
    // exclude : {
    //   // path: an array of regular expressions in strings to match against
    //   path: '',
    // },

    // Which modules to exclusively include (array of regular expressions in strings)
    // dependency-cruiser will skip everything that doesn't match this pattern
    // includeOnly : [''],

    // List of module systems to cruise.
    // When left out dependency-cruiser will fall back to the list of _all_
    // module systems it knows of ('amd', 'cjs', 'es6', 'tsd']). It's the
    // default because it's the safe option. It comes at a performance penalty, though
    // As in practice only commonjs ('cjs') and ecmascript modules ('es6')
    // are in wide use, you can limit the moduleSystems to those.
    moduleSystems: ['cjs', 'es6'],

    // false: don't look at JSDoc imports (the default)
    // true: detect dependencies in JSDoc-style import statements.
    // Implies parser: 'tsc', which a.o. means the typescript compiler will need
    // to be installed in the same spot you run dependency-cruiser from.
    detectJSDocImports: true,

    // false: don't look at process.getBuiltinModule calls (the default)
    // true: dependency-cruiser will detect calls to process.getBuiltinModule/
    // globalThis.process.getBuiltinModule as imports.
    detectProcessBuiltinModuleCalls: true,

    // prefix for links in html, d2, mermaid and dot/ svg output (e.g. 'https://github.com/you/yourrepo/blob/main/'
    // to open it on your online repo or `vscode://file/${process.cwd()}/` to
    // open it in visual studio code),
    // prefix: `vscode://file/${process.cwd()}/`,

    // suffix for links in output. E.g. put .html here if you use it to link to
    // your coverage reports.
    // suffix: '.html',

    // false (the default): ignore dependencies that only exist before typescript-to-javascript compilation
    // true: also detect dependencies that only exist before typescript-to-javascript compilation
    // 'specify': for each dependency identify whether it only exists before compilation or also after
    tsPreCompilationDeps: false,

    // list of extensions to scan that aren't javascript or compile-to-javascript.
    // Empty by default. Only put extensions in here that you want to take into
    // account that are _not_ parsable.
    // extraExtensionsToScan: ['.json', '.jpg', '.png', '.svg', '.webp'],

    // if true combines the package.jsons found from the module up to the base
    // folder the cruise is initiated from. Useful for how (some) mono-repos
    // manage dependencies & dependency definitions.
    combinedDependencies: false,

    // if true leave symlinks untouched, otherwise use the realpath
    preserveSymlinks: true,

    // TypeScript project file ('tsconfig.json') to use for
    // (1) compilation and
    // (2) resolution (e.g. with the paths property)
    //
    // The (optional) fileName attribute specifies which file to take (relative to
    // dependency-cruiser's current working directory). When not provided
    // defaults to './tsconfig.json'.
    tsConfig: {
      fileName: 'tsconfig.check.json',
    },

    // Webpack configuration to use to get resolve options from.
    //
    // The (optional) fileName attribute specifies which file to take (relative
    // to dependency-cruiser's current working directory. When not provided defaults
    // to './webpack.conf.js'.
    //
    // The (optional) 'env' and 'arguments' attributes contain the parameters
    // to be passed if your webpack config is a function and takes them (see
    //  webpack documentation for details)
    // webpackConfig: {
    //  fileName: 'webpack.config.js',
    //  env: {},
    //  arguments: {}
    // },

    // Babel config ('.babelrc', '.babelrc.json', '.babelrc.json5', ...) to use
    // for compilation
    // babelConfig: {
    //   fileName: '.babelrc',
    // },

    // List of strings you have in use in addition to cjs/ es6 requires
    // & imports to declare module dependencies. Use this e.g. if you've
    // re-declared require, use a require-wrapper or use window.require as
    // a hack.
    // exoticRequireStrings: [],

    // options to pass on to enhanced-resolve, the package dependency-cruiser
    // uses to resolve module references to disk. The values below should be
    // suitable for most situations
    //
    // If you use webpack: you can also set these in webpack.conf.js. The set
    // there will override the ones specified here.
    enhancedResolveOptions: {
      // What to consider as an 'exports' field in package.jsons
      exportsFields: ['exports'],

      // List of conditions to check for in the exports field.
      // Only works when the 'exportsFields' array is non-empty.
      conditionNames: ['import', 'require', 'node', 'default', 'types'],

      // The extensions, by default are the same as the ones dependency-cruiser
      // can access (run `npx depcruise --info` to see which ones that are in
      // _your_ environment). If that list is larger than you need you can pass
      // the extensions you actually use (e.g. ['.js', '.jsx']). This can speed
      // up module resolution, which is the most expensive step.
      // extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts"],

      // What to consider a 'main' field in package.json
      mainFields: ['module', 'main', 'types', 'typings'],

      // A list of alias fields in package.jsons
      // See https://github.com/defunctzombie/package-browser-field-spec and
      // the webpack [resolve.alias](https://webpack.js.org/configuration/resolve/#resolvealiasfields)
      // documentation.
      // Defaults to an empty array (= don't use alias fields).
      // aliasFields: ['browser'],
    },

    // skipAnalysisNotInRules will make dependency-cruiser execute
    // analysis strictly necessary for checking the rule set only.
    // See https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#skipanalysisnotinrules
    skipAnalysisNotInRules: true,

    reporterOptions: {
      dot: {
        // Pattern of modules to consolidate to. The default pattern in this configuration
        // collapses everything in node_modules to one folder deep so you see
        // the external modules, but not their innards.
        collapsePattern: 'node_modules/(?:@[^/]+/[^/]+|[^/]+)',

        // Options to tweak the appearance of your graph. See
        // https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#reporteroptions
        // If you don't specify a theme dependency-cruiser falls back to a built-in one.
        // theme: {
        //   graph: {
        //     // splines: 'ortho' - straight lines; slow on big graphs
        //     // splines: 'true' - bezier curves; fast but not as nice as ortho
        //     splines: 'true'
        //   },
        // },
      },
      archi: {
        // Pattern of modules to consolidate to.
        collapsePattern: '^(?:packages|src|lib(s?)|app(s?)|bin|test(s?)|spec(s?))/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)',

        // Options to tweak the appearance of your graph. If you don't specify a
        // theme for 'archi' dependency-cruiser will use the one specified in the
        // dot section above and otherwise use the default one.
        // theme: { },
      },
      text: {
        highlightFocused: true,
      },
    },
  },
}
// generated: dependency-cruiser@17.3.8 on 2026-03-05T13:00:09.606Z
