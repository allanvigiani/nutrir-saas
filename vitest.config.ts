import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/server/**/*.ts'],
      exclude: [
        'src/server/register-api-routes.ts', // apenas glue code
        'src/server/firestore-helpers.ts',    // integração com Firebase (não testamos aqui)
        'src/server/integrations/**',
        'src/server/types.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Permite imports com extensão .ts explícita (usado nos arquivos do projeto)
    extensions: ['.ts', '.tsx', '.js'],
  },
});
