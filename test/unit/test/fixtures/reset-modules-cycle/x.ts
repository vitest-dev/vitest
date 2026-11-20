if (process.env.RESET_MODULES_CYCLE) {
  await import('./y')
}
await new Promise((resolve) => setTimeout(resolve, 200))

export const value = 'ready'
