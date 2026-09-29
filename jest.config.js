// Jest com jest-preset-angular (Angular 21 sem zone.js).
module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    // O fundo animado (WebGL) não roda no jsdom: usamos um substituto simples.
    '^vanta/dist/vanta.net.min$': '<rootDir>/src/testing/vanta-falso.ts',
  },
  transform: {
    '^.+\.(ts|js|mjs|html|svg)$': ['jest-preset-angular', { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\.(html|svg)$' }],
  },
  collectCoverageFrom: [
    'src/app/core/**/*.ts',
    'src/app/shared/**/*.ts',
    'src/app/features/**/utils/*.ts',
    'src/app/features/**/services/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  // "html" quebra neste ambiente (caminho com "file:" no Windows/Git Bash); texto já basta.
  coverageReporters: ['text-summary', 'text'],
};
