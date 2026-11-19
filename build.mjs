// Builds the installable module into dist/, laid out exactly as Foundry expects:
//   dist/module.json, scripts/, styles/, lang/, templates/, LICENSE, README.md
// `--dev` adds source maps. Symlink dist/ to <Foundry data>/modules/heroes-theme to test.
//
// The script and stylesheet carry the version in their file name. Browsers and
// reverse proxies cache them by URL, so a fixed name let an old script keep
// running against new templates after an update.
import { cp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const dev = process.argv.includes('--dev');
const STATIC = ['styles', 'lang', 'templates', 'LICENSE', 'README.md'];

const manifest = JSON.parse(await readFile('module.json', 'utf8'));
const script = `scripts/module-${manifest.version}.js`;
const style = `styles/heroes-theme-${manifest.version}.css`;

await rm('dist', { recursive: true, force: true });
await build({
  entryPoints: ['src/module.ts'],
  outfile: `dist/${script}`,
  bundle: true,
  format: 'esm',
  target: 'es2024',
  minify: !dev,
  sourcemap: dev,
  logLevel: 'info',
});
await Promise.all(STATIC.map((path) => cp(path, `dist/${path}`, { recursive: true })));
await rename('dist/styles/heroes-theme.css', `dist/${style}`);
// The packaged manifest is attached to a specific release, so its download must
// point at that release's zip. `manifest` stays on latest so installs see updates.
const download = `${manifest.url}/releases/download/v${manifest.version}/heroes-theme.zip`;
await writeFile(
  'dist/module.json',
  `${JSON.stringify({ ...manifest, download, esmodules: [script], styles: [style] }, null, 2)}\n`,
);
