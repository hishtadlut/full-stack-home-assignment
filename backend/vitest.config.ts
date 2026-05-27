import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/assistant/liveAssistant.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/app.ts',
        'src/routes/**/*.ts',
        'src/controllers/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
        'src/realtime/**/*.ts',
        'src/assistant/draftValidator.ts',
        'src/assistant/executor.ts',
        'src/assistant/repository.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/assistant/liveAssistant.test.ts',
        'src/assistant/geminiAssistant.ts',
        'src/assistant/types.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
