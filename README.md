# heroes-theme-foundry

Foundry VTT v14 client module of **Hero's Theme**. It connects to [heroes-theme-bot](https://github.com/breno-hof/heroes-theme-bot), runs the trigger logic from [heroes-theme-core](https://github.com/breno-hof/heroes-theme-core), and plays each speaker's theme through native Foundry playlists.

**Status: skeleton.** It typechecks and bundles, but has not yet been run inside Foundry, and there is no UI for editing mappings.

## Layout

- `module.json`: Foundry manifest (minimum v14, verified 14.369).
- `src/module.ts`: registers settings and starts the listener on the active GM's client.
- `src/bridge-listener.ts`: WebSocket connection with handshake and reconnect backoff; feeds the core `ThemeStateManager`.
- `src/foundry-player.ts`: executes `theme.play` / `theme.stop` on `PlaylistSound` documents. A mapping's `themeId` is a PlaylistSound UUID.
- `src/foundry.d.ts`: hand-written declarations for the few Foundry APIs used.

Only the active GM connects to the bot. Playlist playback is a document update, so Foundry replicates it to every player, and the bridge token never leaves the GM's browser.

## Develop

Installing the core from GitHub Packages needs a token with `read:packages`:

```sh
export GITHUB_TOKEN=<token>
npm install
npm run check   # typecheck and bundle to dist/module.js
```

Until the core's first release is published, install it from a sibling checkout instead: `npm install --no-save ../heroes-theme-core` (build the core first).

## 📄 License
This project is open-source under the **AGPL-3.0** license — see the [LICENSE](LICENSE) file for details. You are free to use and modify it, provided that any derivative work remains open-source and credits the original author.

Copyright (c) 2026 breno-hof. Licensed under the AGPL-3.0 License.
