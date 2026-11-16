import { ThemeSetApp } from './theme-set-app.js';

const ICON = 'fa-solid fa-music';
const LABEL = 'HEROESTHEME.Actor.Control';

/**
 * Adds a "Hero's Theme" entry to the header of every actor sheet, whatever
 * game system or sheet class draws it, for users who own the actor.
 */
export function registerSheetControls(): void {
  // ApplicationV2 sheets: an entry in the header's controls dropdown.
  Hooks.on('getHeaderControlsApplicationV2', (app, controls) => {
    const actor = actorOf(app);
    // Tidy sheets get their entry through Tidy's own API below; adding one here too would duplicate it.
    if (actor === null || !Array.isArray(controls) || isTidySheet(app)) return;
    controls.push({ icon: ICON, label: LABEL, action: 'heroesThemeActor', onClick: () => open(actor) });
  });
  // Legacy Application (V1) sheets, still used by many systems: a header button.
  Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
    const actor = actorOf(sheet);
    if (actor === null || !Array.isArray(buttons)) return;
    buttons.unshift({
      label: game.i18n.localize(LABEL),
      class: 'heroes-theme-actor',
      icon: ICON,
      onclick: () => open(actor),
    });
  });
  // Tidy 5e Sheets draws its own header and only wires up controls registered through its API.
  Hooks.once('tidy5e-sheet.ready', (api) => {
    (api as TidyApi | undefined)?.registerActorHeaderControls?.({
      controls: [
        {
          icon: ICON,
          label: game.i18n.localize(LABEL),
          action: 'heroesThemeActor',
          ownership: 'OWNER',
          position: 'menu',
          // Tidy binds `this` to the sheet application.
          async onClickAction(this: unknown): Promise<void> {
            const actor = actorOf(this);
            if (actor !== null) open(actor);
          },
        },
      ],
    });
  });
}

/** The one method used from https://github.com/kgar/foundry-vtt-tidy-5e-sheets (`Tidy5eSheetsApi`). */
interface TidyApi {
  registerActorHeaderControls?(params: {
    controls: Array<{
      icon: string;
      label: string;
      action?: string;
      ownership?: string | number;
      position?: 'header' | 'menu';
      onClickAction?: (event: PointerEvent, target: HTMLElement) => Promise<void>;
    }>;
  }): void;
}

function isTidySheet(app: unknown): boolean {
  const classes = (app as { options?: { classes?: unknown } }).options?.classes;
  return Array.isArray(classes) && classes.some((name) => typeof name === 'string' && name.startsWith('tidy5e'));
}

function open(actor: FoundryActor): void {
  void new ThemeSetApp({ kind: 'actor', actor }).render({ force: true });
}

/** The actor a sheet application is showing, if it is an actor sheet the current user owns. */
function actorOf(app: unknown): FoundryActor | null {
  if (typeof app !== 'object' || app === null) return null;
  const candidate = (app as { document?: unknown; actor?: unknown }).document ?? (app as { actor?: unknown }).actor;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const actor = candidate as Partial<FoundryActor>;
  return actor.documentName === 'Actor' && actor.isOwner === true ? (actor as FoundryActor) : null;
}
