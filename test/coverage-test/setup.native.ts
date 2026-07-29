if (globalThis.process?.env.VITE_MODULE_RUNNER === 'false') {
  const { registerHooks } = await import('node:module')

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL && specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier) && !context.parentURL.includes('/node_modules/')) {
        specifier += '.ts'
      }

      return nextResolve(specifier, context)
    },
  })
}

export {}
