# heroes-theme-foundry

Foundry VTT v14 module of **Hero's Theme**. It follows who is speaking in Foundry's built-in audio/video chat, runs the trigger logic from [heroes-theme-core](https://github.com/breno-hof/heroes-theme-core), and plays each speaker's theme through native Foundry playlists. No external service is needed.

**Status: untested in Foundry.** It typechecks, bundles and packages, but has not yet been run inside a Foundry world.

## Install

In Foundry, go to **Add-on Modules → Install Module** and paste the manifest URL:

```
https://github.com/breno-hof/heroes-theme-foundry/releases/latest/download/module.json
```

Then turn on Foundry's audio/video chat (**Configure Settings → Core → Configure Audio/Video**) and have players join it with their microphone on. Voice activation and push-to-talk both work: a theme plays while Foundry shows that user as speaking.

As GM, **Game Settings → Configure Settings → Hero's Theme → Table setup** chooses who takes part (everyone, by default), a fallback theme per player, and trigger timing. That menu is visible to the GM only.

### Optional: Discord voice

Groups that talk on Discord instead of Foundry A/V can run the self-hosted [heroes-theme-bot](https://github.com/breno-hof/heroes-theme-bot) and pick **Discord** as the voice source in **Table setup**, then fill in the bridge URL and token and each player's Discord user ID. The module works fully without it.

Worlds set up before Foundry A/V was supported keep using Discord after updating, as long as players were linked to Discord IDs: nothing needs reconfiguring.

## How themes are chosen

- **Players** pick their own themes, one per mood (Default, Calm, Tense, Combat, Sad, Triumphant), under **My themes**. The mood picker at the bottom of the Players list changes their mood at any time; the theme switches even mid-sentence.
- **Player music**: each participating player gets a playlist they own (`Hero's Theme - <name>`) to add their own tracks to. Uploading needs Foundry's upload permission, which the GM can switch on or off for players in **Table setup**.
- **Characters** can have their own themes, set from the **Hero's Theme** entry in the header of any actor sheet, whatever the game system. A character's themes apply while the speaker controls its token; a player without a selected token voices their assigned character.
- **The GM** has no theme by default. While a GM has an NPC token selected, that character's theme plays when the GM speaks. Selecting a player-owned token does not trigger that player's theme.

Order of precedence: character + mood, character default, player + mood, player default, then the fallback the GM chose in **Table setup**. If none applies, nothing plays.

## Layout

- `module.json`: Foundry manifest (minimum v14, verified 14.369).
- `src/module.ts`: wiring. Registers everything and keeps the core state manager in sync on the active GM's client.
- `src/theme-engine.ts`: wraps the core `ThemeStateManager`, keyed by Foundry user.
- `src/foundry-av-source.ts`: speech detection from Foundry's A/V chat (the default).
- `src/discord-bridge-source.ts`: optional speech detection from the Discord bot, over a WebSocket with handshake and reconnect backoff.
- `src/foundry-player.ts`: executes `theme.play` / `theme.stop` on `PlaylistSound` documents.
- `src/settings.ts`: settings, and conversion of links, user flags and actor flags into the core config.
- `src/flags.ts`: themes, mood and active character, stored as user and actor flags.
- `src/persona.ts`: each client reports which character its user is voicing.
- `src/theme-config-app.ts`: the GM's configuration form (ApplicationV2).
- `src/theme-set-app.ts`: the per-mood theme picker, for a player or a character.
- `src/mood-widget.ts`, `src/sheet-controls.ts`: the mood picker in the Players list and the actor sheet header entry.
- `src/sounds.ts`, `src/uploads.ts`: per-player playlists and the upload permission toggle.
- `src/foundry.d.ts`: hand-written declarations for the few Foundry APIs used.
- `templates/`, `lang/`, `styles/`: Handlebars templates, translations (English, Brazilian Portuguese) and CSS.

Only the active GM's client runs the trigger logic (and, with Discord, connects to the bot). Playlist playback is a document update, so Foundry replicates it to every player, and the bridge token never leaves the GM's browser. Links, themes, moods and active characters are world data: no player sees them in any screen, but they are readable from the browser console.

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

Bump `version` in both `module.json` and `package.json`, merge, then push a matching tag (`v0.2.0`). The Release workflow builds, zips `dist/` into `heroes-theme.zip`, and publishes a GitHub Release with the zip and `module.json` attached. It then registers the version on the foundryvtt.com package listing, using the package's release token from the `FOUNDRY_RELEASE_TOKEN` repository secret (the step is skipped with a warning when the secret is missing).

## 📄 License
This project is open-source under the **AGPL-3.0** license — see the [LICENSE](LICENSE) file for details. You are free to use and modify it, provided that any derivative work remains open-source and credits the original author.

Copyright (c) 2026 breno-hof. Licensed under the AGPL-3.0 License.
