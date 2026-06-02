import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // O pacote @exodus/shared é distribuído como source TS; o bundle o inclui.
  noExternal: ['@exodus/shared'],
});
