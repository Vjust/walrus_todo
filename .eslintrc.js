module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // Add prettier to avoid conflicts if used
  ],
  env: {
    node: true,
    jest: true, // Assuming Jest is used based on package.json
  },
  rules: {
    // Add any project-specific rules here if needed
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }], // Warn about unused vars, ignore if prefixed with _
    '@typescript-eslint/no-explicit-any': 'warn', // Warn about using 'any' type
  },
  ignorePatterns: ["dist/", "node_modules/", "*.js"], // Ignore build output, dependencies, and JS files if primarily TS
};