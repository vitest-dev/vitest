declare module 'kill-port' {
  const kill: (port: number) => Promise<void>
  export default kill
}
