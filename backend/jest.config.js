// @ts-check

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/db/seed.ts',
    '!src/db/pool.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 30,
      functions: 30,
      branches: 20,
      statements: 30,
    },
  },
  coverageReporters: ['text', 'lcov', 'clover'],
  testTimeout: 10000,
};
