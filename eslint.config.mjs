import { dirname } from 'path';
import { fileURLToPath } from 'url';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import eslintConfigNext from 'eslint-config-next';

const configDir = dirname(fileURLToPath(import.meta.url));

const eslintConfig = [
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'build/**', 'coverage/**', '**/*.min.js', 'src/payload-types.ts'],
  },
  ...eslintConfigNext,
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['log', 'warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: configDir,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];

export default eslintConfig;
