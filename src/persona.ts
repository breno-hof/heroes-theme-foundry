import { getActiveActorId, setActiveActorId } from './flags.js';
import { participatingUserIds } from './settings.js';

/**
 * Every client reports which character its user is voicing, because only that
 * client knows which token its user has selected. The GM's client, which runs
 * the state manager, reads the result from the user's flags.
 */
export function registerPersonaReporting(): void {
  const report = foundry.utils.debounce(() => void reportPersona(), 150);
  Hooks.on('controlToken', report);
  Hooks.on('canvasReady', report);
  report();
}

async function reportPersona(): Promise<void> {
  // Users who cannot trigger a theme do not need their persona reported.
  if (!participatingUserIds().includes(game.user.id)) return;
  const actorId = currentActorId();
  if (actorId !== getActiveActorId(game.user)) await setActiveActorId(game.user, actorId);
}

function currentActorId(): string | null {
  const actor = canvas?.tokens?.controlled[0]?.actor ?? null;
  if (actor === null) return null;
  // The GM voices NPCs. Selecting a player's character (to move it, say) must
  // not make the GM's voice trigger that player's theme.
  if (game.user.isGM) return actor.hasPlayerOwner ? null : actor.id;
  return actor.isOwner ? actor.id : null;
}
