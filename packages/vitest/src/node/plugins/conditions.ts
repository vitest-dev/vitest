function normalizeConditions(conditions?: string[]) {
  if (!conditions) {
    return []
  }

  // We remove browser and node conditions from the default list because
  // we add back "node" explicitly in both client and server conditions.
  // this ensures that the conditions we pass on to vite doesn't include
  // both browser and node at the same time, or node twice in the server case.
  return conditions.filter(c => c !== 'browser' && c !== 'node')
}

async function getDefaultConditions() {
  type Vite6Options = typeof import('vite') & Partial<{
    defaultClientConditions?: string[]
    defaultServerConditions?: string[]
  }>
  const vite: Vite6Options = await import('vite')

  return {
    defaultClientConditions: vite.defaultClientConditions,
    defaultServerConditions: vite.defaultServerConditions,
  }
}

export async function getConditions() {
  const { defaultClientConditions, defaultServerConditions } = await getDefaultConditions()
  return {
    clientConditions: ['node', ...normalizeConditions(defaultClientConditions)],
    serverConditions: ['node', ...normalizeConditions(defaultServerConditions)],
  }
}
