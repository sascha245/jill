import type { Config } from 'jest';

const config: Config = {
  roots: [
    '<rootDir>/e2e'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/e2e/setup.ts'
  ],
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest'
  },
};

export default config;