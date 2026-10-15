import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  clean: true,
  // The shared package ships TypeScript sources, so it is bundled in.
  noExternal: ['@silt/shared'],
});
