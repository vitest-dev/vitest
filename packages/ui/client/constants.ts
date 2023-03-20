export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${HOST}/__vitest_api__`
// @ts-expect-error METADATA_PATH is not typed
export const isReport = !!window.METADATA_PATH
// @ts-expect-error __BASE_PATH__ is injected
export const BASE_PATH = isReport ? import.meta.env.BASE_URL : __BASE_PATH__
