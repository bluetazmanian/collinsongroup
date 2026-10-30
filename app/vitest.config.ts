import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@atp/concepts': src('./packages/concepts/src/index.ts'),
      '@atp/rules': src('./packages/rules/src/index.ts'),
      '@atp/adapters': src('./packages/adapters/src/index.ts'),
    },
  },
  test: { include: ['packages/*/test/**/*.test.ts'] },
});
