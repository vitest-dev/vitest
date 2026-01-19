if (globalThis.process?.env.VITE_MODULE_RUNNER === 'false') {
  const { registerHooks } = await import('node:module')

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
        specifier += '.ts'
      }

      return nextResolve(specifier, context)
    },
  })
}

export {}
