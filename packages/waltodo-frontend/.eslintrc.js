module.exports = {
  root: true,
  extends: ['next', 'next/core-web-vitals'],
  rules: {
    'react/no-unescaped-entities': 'off',
    '@next/next/no-page-custom-font': 'off',
  },
  settings: {
    next: {
      rootDir: __dirname,
    },
  },
};