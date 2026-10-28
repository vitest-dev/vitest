const PORT = import.meta.hot ? import.meta.env.VITE_PORT || '51204' : location.port
const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__?token=${(window as any).VITEST_API_TOKEN}`
export const isReport = !!window.HTML_REPORT_METADATA
// renders every explorer row and editor line, used by e2e tests
export const disableVirtualization = !!(window as any).VITEST_UI_DISABLE_VIRTUALIZATION
