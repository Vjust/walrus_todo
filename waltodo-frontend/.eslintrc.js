module.exports = {
  root: true,
  extends: ['next', 'next/core-web-vitals'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  rules: {
    'react/no-unescaped-entities': 'off',
    '@next/next/no-page-custom-font': 'off',
  },
  settings: {
    next: {
      rootDir: __dirname,
    },
    react: {
      version: 'detect',
    },
  },
};