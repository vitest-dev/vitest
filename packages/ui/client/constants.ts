export const PORT = import.meta.hot ? (import.meta.env.VITE_PORT || '51204') : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__?token=${(window as any).VITEST_API_TOKEN || '0'}`
export const isReport = !!window.METADATA_PATH
export const BASE_PATH = isReport ? import.meta.env.BASE_URL : __BASE_PATH__
