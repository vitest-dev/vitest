module.exports = {
  moduleFileExtensions: [
    'js',
    'json',
    'ts',
    'vue',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '.*\\.(vue)$': '@vue/vue3-jest',
    '.*\\.(ts)$': 'babel-jest',
  },
  testEnvironment: 'jsdom',
  verbose: false,
  reporters: [
    ['jest-simple-dot-reporter', { color: true }],
  ],
}
