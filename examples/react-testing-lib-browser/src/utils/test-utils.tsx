import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'

export async function createContainer(id: string, node: ReactNode) {
  const container = document.createElement('div')
  container.setAttribute('id', id)
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(node)

  await nextTick()

  return root
}

export async function nextTick() {
  await new Promise(resolve => setTimeout(resolve, 0))
}
