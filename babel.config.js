module.exports = {
  presets: [
    ['@babel/preset-env', { 
      targets: { node: '18' },
      modules: 'commonjs',  // Ensure ES6 imports are transformed to CommonJS
      loose: true,  // Use loose transformations to avoid class inheritance issues
      bugfixes: true,  // Enable bug fixes for better compatibility
      debug: false
    }],
    ['@babel/preset-typescript', {
      allowDeclareFields: true,  // Allow class field declarations
      onlyRemoveTypeImports: true,  // Only remove type imports
      optimizeConstEnums: true,  // Optimize const enums
      allowNamespaces: true  // Allow TypeScript namespaces
    }],
  ],
  plugins: [
    // Transform dynamic imports for Jest compatibility
    '@babel/plugin-syntax-dynamic-import',
    // Add plugin to handle class property inheritance issues
    ['@babel/plugin-transform-class-properties', { 
      loose: true 
    }],
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', { 
          targets: { node: 'current' },
          modules: 'commonjs',
          loose: true
        }],
        ['@babel/preset-typescript', {
          allowDeclareFields: true,
          onlyRemoveTypeImports: true,
        }],
      ],
    },
  },
};
