import { dirname } from 'path';
import { fileURLToPath } from 'url';
import eslintConfigNext from 'eslint-config-next';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'build/**', 'coverage/**', 'payload-types.ts'],
  },
  ...eslintConfigNext,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];