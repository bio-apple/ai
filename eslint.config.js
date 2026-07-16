import js from '@eslint/js';
import globals from 'globals';

/** 轻量 JS/MJS 校验：抓明显错误，不做风格重排（风格交给 Prettier） */
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'public/**',
      'vendor/**',
      '.venv/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.min.js',
      'video-thumbs/**',
    ],
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        trackEvent: 'readonly',
        Fuse: 'readonly',
        gtag: 'readonly',
        dataLayer: 'writable',
        umami: 'writable',
        showSection: 'readonly',
        bioFavorites: 'writable',
        bioProgress: 'writable',
        bioEngagement: 'writable',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-console': 'off',
      'no-undef': 'error',
    },
  },
];
