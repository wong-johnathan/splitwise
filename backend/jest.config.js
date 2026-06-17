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
    '!src/services/websocket.ts',
    '!src/routes/test-auth.ts',
    '!src/routes/payments.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 10,
      functions: 10,
      branches: 10,
      statements: 10,
    },
  },
  coverageReporters: ['text', 'lcov', 'clover'],
  testTimeout: 10000,
};
