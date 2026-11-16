/**
 * Lets the GM allow or forbid players uploading audio, by editing Foundry's
 * own role permissions (the same ones shown under User Management >
 * Configure Permissions). Without upload rights a player can still pick from
 * sounds already in their playlist.
 */
const ROLE = { PLAYER: 1, TRUSTED: 2 } as const;
const PLAYER_ROLES: readonly number[] = [ROLE.PLAYER, ROLE.TRUSTED];

type Permissions = Record<string, number[]>;

function readPermissions(): Permissions {
  const value = game.settings.get('core', 'permissions');
  return typeof value === 'object' && value !== null ? foundry.utils.deepClone(value as Permissions) : {};
}

export function playersCanUpload(): boolean {
  return readPermissions()['FILES_UPLOAD']?.includes(ROLE.PLAYER) ?? false;
}

export async function setPlayerUploads(enabled: boolean): Promise<void> {
  const permissions = readPermissions();
  const grant = (key: string): void => {
    permissions[key] = [...new Set([...(permissions[key] ?? []), ...PLAYER_ROLES])].sort();
  };
  if (enabled) {
    // Uploading goes through the file browser, so players need both.
    grant('FILES_BROWSE');
    grant('FILES_UPLOAD');
  } else {
    // Browsing is left as it is: other modules or the GM may rely on it.
    permissions['FILES_UPLOAD'] = (permissions['FILES_UPLOAD'] ?? []).filter((role) => !PLAYER_ROLES.includes(role));
  }
  await game.settings.set('core', 'permissions', permissions);
}
