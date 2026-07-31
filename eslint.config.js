import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        trackEvent: 'readonly',
        escapeHtml: 'readonly',
        handleDataError: 'readonly',
        Fuse: 'readonly',
        gtag: 'readonly',
        clarity: 'readonly',
        showSection: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-undef': 'error',
    },
  },
  {
    ignores: [
      'dist/',
      'public/',
      'node_modules/',
      '.astro/',
      'vendor/',
      'playwright-report/',
      'test-results/',
    ],
  },
];
