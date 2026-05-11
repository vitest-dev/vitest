export const PORT = import.meta.hot ? (import.meta.env.VITE_PORT || '51204') : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__?token=${(window as any).VITEST_API_TOKEN}`
export const isReport = !!window.METADATA_PATH
