export default {
  addons: ['@storybook/addon-essentials'],
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  staticDirs: ['../public'],
  framework: '@storybook/react-vite',
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
