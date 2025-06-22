// TODO: remove when --workspace is removed
export default [
  {
    test: {
      name: "Browser project",
      browser: {
         enabled: true,
         provider: 'webdriverio',
         instances: [{ browser: 'chrome' }]
      },
    }
  }
]