import { vi } from 'vitest'

// Para testes E2E browser, normalmente não precisa de setup adicional.
// Se precisar mockar APIs globais, faça isso condicionalmente:

// Exemplo: mock para requestAnimationFrame se não existir (opcional)
if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb) => setTimeout(cb, 16)
    window.cancelAnimationFrame = (id) => clearTimeout(id)
}

// Se precisar de mocks só no Node:
// if (typeof window === 'undefined') {
//   // node-only setup
// }