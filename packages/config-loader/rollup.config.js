import typescript from '@rollup/plugin-typescript';

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'dist',
        declaration: true,
        declarationDir: 'dist'
      })
    ],
    external: ['fs/promises', 'path']
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'dist',
        declaration: false // Only generate declarations once
      })
    ],
    external: ['fs/promises', 'path']
  }
];