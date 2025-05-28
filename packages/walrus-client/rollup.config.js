import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

const external = [
  'cross-fetch',
  'react',
  '@mysten/sui/client',
  '@mysten/sui/cryptography',
  '@mysten/sui/keypairs/ed25519',
  '@mysten/sui/transactions',
  '@mysten/walrus',
  'crypto',
  'fs',
  'path',
  'os'
];

const config = [
  // Main bundle
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/index.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    external,
    plugins: [
      nodeResolve({
        preferBuiltins: true,
        browser: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
      }),
    ],
  },
  // Hooks bundle (separate entry for React hooks)
  {
    input: 'src/hooks/index.ts',
    output: [
      {
        file: 'dist/hooks/index.js',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/hooks/index.esm.js',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: [...external, '../client/WalrusTodoStorage', '../types', '../errors'],
    plugins: [
      nodeResolve({
        preferBuiltins: true,
        browser: false,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist/hooks',
        include: ['src/hooks/**/*'],
      }),
    ],
  },
];

export default config;