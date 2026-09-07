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
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/scripts/**/*'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 20,
      lines: 20,
      statements: 20,
    },
    './src/agent/chat-service.ts': {
      branches: 40,
      functions: 40,
      lines: 50,
      statements: 50,
    },
    './src/agent/stream-manager.ts': {
      branches: 45,
      functions: 60,
      lines: 45,
      statements: 45,
    },
    './src/agent/engines/claude.ts': {
      branches: 25,
      functions: 35,
      lines: 35,
      statements: 35,
    },
    './src/agent/engines/codex.ts': {
      branches: 20,
      functions: 40,
      lines: 45,
      statements: 45,
    },
    './src/server/routes/agent.ts': {
      branches: 4,
      functions: 20,
      lines: 20,
      statements: 20,
    },
  },
};
