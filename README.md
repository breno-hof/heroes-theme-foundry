# heroes-theme-foundry

Foundry VTT v14 client module of **Hero's Theme**. It connects to [heroes-theme-bot](https://github.com/breno-hof/heroes-theme-bot), runs the trigger logic from [heroes-theme-core](https://github.com/breno-hof/heroes-theme-core), and plays each speaker's theme through native Foundry playlists.

**Status: untested in Foundry.** It typechecks, bundles and packages, but has not yet been run inside a Foundry world.

## Install

In Foundry, go to **Add-on Modules → Install Module** and paste the manifest URL:

```
https://github.com/breno-hof/heroes-theme-foundry/releases/latest/download/module.json
```

Then, as GM, open **Game Settings → Configure Settings → Hero's Theme**: set the bridge URL and token, and use **Configure themes** to link each player to a Discord user ID and a playlist sound.

## Layout

- `module.json`: Foundry manifest (minimum v14, verified 14.369).
- `src/module.ts`: registers settings and starts the listener on the active GM's client.
- `src/bridge-listener.ts`: WebSocket connection with handshake and reconnect backoff; feeds the core `ThemeStateManager`.
- `src/foundry-player.ts`: executes `theme.play` / `theme.stop` on `PlaylistSound` documents.
- `src/theme-config-app.ts` + `templates/theme-config.hbs`: the ApplicationV2 configuration form.
- `src/settings.ts`: setting registration and conversion to the core config.
- `src/foundry.d.ts`: hand-written declarations for the few Foundry APIs used.
- `lang/`, `styles/`: translations (English, Brazilian Portuguese) and CSS.

Only the active GM connects to the bot. Playlist playback is a document update, so Foundry replicates it to every player, and the bridge token never leaves the GM's browser.

## Develop

Installing the core from GitHub Packages needs a token with `read:packages`:

```sh
export GITHUB_TOKEN=<token>
npm install
npm run check   # typecheck and build into dist/
npm run dev     # same build, unminified with source maps
```

`dist/` is the complete installable module. Symlink it to `<Foundry data>/modules/heroes-theme` to test.

## Release

Bump `version` in both `module.json` and `package.json`, merge, then push a matching tag (`v0.2.0`). The Release workflow builds, zips `dist/` into `heroes-theme.zip`, and publishes a GitHub Release with the zip and `module.json` attached.

## 📄 License
This project is open-source under the **AGPL-3.0** license — see the [LICENSE](LICENSE) file for details. You are free to use and modify it, provided that any derivative work remains open-source and credits the original author.

Copyright (c) 2026 breno-hof. Licensed under the AGPL-3.0 License.
