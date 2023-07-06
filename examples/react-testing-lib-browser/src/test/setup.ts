import '@testing-library/jest-dom'

if (typeof window !== 'undefined') {
  // @ts-expect-error hack the react preamble
  window.__vite_plugin_react_preamble_installed__ = true
}
