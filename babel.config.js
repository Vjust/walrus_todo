module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: 'current' },
      modules: 'commonjs'  // Ensure ES6 imports are transformed to CommonJS
    }],
    '@babel/preset-typescript',
  ],
  plugins: [
    // Transform dynamic imports for Jest compatibility
    '@babel/plugin-syntax-dynamic-import',
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { 
          targets: { node: 'current' },
          modules: 'commonjs'
        }],
        '@babel/preset-typescript',
      ],
    },
  },
};
