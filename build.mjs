// Builds the installable module into dist/, laid out exactly as Foundry expects:
//   dist/module.json, scripts/, styles/, lang/, templates/, LICENSE, README.md
// `--dev` adds source maps. Symlink dist/ to <Foundry data>/modules/heroes-theme to test.
import { cp, rm } from 'node:fs/promises';
import { build } from 'esbuild';

const dev = process.argv.includes('--dev');
const STATIC = ['module.json', 'styles', 'lang', 'templates', 'LICENSE', 'README.md'];

await rm('dist', { recursive: true, force: true });
await build({
  entryPoints: ['src/module.ts'],
  outfile: 'dist/scripts/module.js',
  bundle: true,
  format: 'esm',
  target: 'es2024',
  minify: !dev,
  sourcemap: dev,
  logLevel: 'info',
});
await Promise.all(STATIC.map((path) => cp(path, `dist/${path}`, { recursive: true })));
