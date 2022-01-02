module.exports = {
  moduleFileExtensions: [
    'js',
    'json',
    'ts',
    'vue',
  ],
  transform: {
    '.*\\.(vue)$': '@vue/vue3-jest',
    '.*\\.(ts)$': 'babel-jest',
  },
  testEnvironment: 'jsdom',
}
