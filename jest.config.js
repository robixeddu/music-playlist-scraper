/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest/presets/default-esm', 
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js'],
    extensionsToTreatAsEsm: ['.ts'], 
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    
    testMatch: ['<rootDir>/test/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],    
    moduleNameMapper: {
        '^(\\.\\.?\\/.+)\\.js$': '$1', 
    },
};