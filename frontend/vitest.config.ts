import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: ['src/generated/**', 'src/api/schema.d.ts', 'src/api/operations.ts'],
            reporter: ['text', 'json-summary', 'lcov', 'html'],
            reportsDirectory: 'coverage',
            reportOnFailure: true,
        },
    },
});
