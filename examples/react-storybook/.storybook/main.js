module.exports = {
  addons: ['@storybook/addon-essentials'],
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  staticDirs: ['../public'],
  features: {
    storyStoreV7: true,
  },
  framework: '@storybook/react',
  core: {
    builder: '@storybook/builder-vite',
  },
  async viteFinal(config) {
    config.optimizeDeps = {
      ...(config.optimizeDeps || {}),
      include: [
        ...(config?.optimizeDeps?.include || []),
        'msw-storybook-addon',
      ],
    }
    return config
  },
}
