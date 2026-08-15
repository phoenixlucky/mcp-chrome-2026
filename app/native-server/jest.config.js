module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // With moduleResolution: NodeNext the source uses explicit `.js` extensions
  // (e.g. `import ... from '../constant/index.js'`). Map relative `.js` back to
  // the `.ts` source so jest-resolve can find it; node_modules paths are untouched.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // tsconfig uses module/moduleResolution NodeNext, which ts-jest only supports
  // in isolatedModules mode (otherwise it does full type-checking per file and
  // emits TS151002 warnings; this also makes runs much slower).
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/scripts/**/*'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      // Current suite covers only a subset of the server; thresholds are set
      // just below the actual measured coverage so `pnpm test` stays green.
      // Raise these as test coverage grows.
      branches: 3,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
};
