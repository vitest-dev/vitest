export default async (url: URL) => {
  if (url.pathname === '/api/ssr-dep') {
    const lib = await import('./ssr-dep')
    return lib.default
  }
  return 'not-found'
}
