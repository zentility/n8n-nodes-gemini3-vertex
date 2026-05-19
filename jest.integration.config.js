module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/integration/**/*.integration.test.ts'],
  testTimeout: 120000,
};
