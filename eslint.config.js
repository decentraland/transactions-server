const coreServices = require('@dcl/eslint-config/core-services.config')

module.exports = [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '*.config.js',
      'jest.config.js',
    ],
  },
  ...coreServices,
]
