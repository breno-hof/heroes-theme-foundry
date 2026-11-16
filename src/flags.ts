/**
 * Per-user and per-actor data, stored as document flags so that whoever owns
 * the document can edit it: players their own user and characters, the GM
 * everything. Flags are written by other clients, so everything read here is
 * validated before use.
 */
import { MOODS, MoodSchema, type Mood, type ThemeSet } from '@breno-hof/heroes-theme-core';
import { MODULE_ID } from './constants.js';

const Flag = { Themes: 'themes', Mood: 'mood', ActiveActor: 'activeActorId' } as const;

/** Themes chosen on a user or an actor, by mood. */
export function getThemes(document: FoundryDocument): ThemeSet {
  const raw = document.getFlag(MODULE_ID, Flag.Themes);
  if (typeof raw !== 'object' || raw === null) return {};
  const themes: ThemeSet = {};
  for (const mood of MOODS) {
    const value = (raw as Record<string, unknown>)[mood];
    if (typeof value === 'string' && value !== '') themes[mood] = value;
  }
  return themes;
}

/**
 * Stores every mood, with '' for "none". Foundry merges flag objects on
 * update, so a key that was simply left out would keep its old value.
 */
export async function setThemes(document: FoundryDocument, themes: ThemeSet): Promise<void> {
  const full = Object.fromEntries(MOODS.map((mood) => [mood, themes[mood] ?? '']));
  await document.setFlag(MODULE_ID, Flag.Themes, full);
}

export function getMood(user: FoundryUser): Mood {
  const parsed = MoodSchema.safeParse(user.getFlag(MODULE_ID, Flag.Mood));
  return parsed.success ? parsed.data : 'default';
}

export async function setMood(user: FoundryUser, mood: Mood): Promise<void> {
  await user.setFlag(MODULE_ID, Flag.Mood, mood);
}

/** The actor of the token this user last reported controlling, if any. */
export function getActiveActorId(user: FoundryUser): string | null {
  const value = user.getFlag(MODULE_ID, Flag.ActiveActor);
  return typeof value === 'string' && value !== '' ? value : null;
}

export async function setActiveActorId(user: FoundryUser, actorId: string | null): Promise<void> {
  await user.setFlag(MODULE_ID, Flag.ActiveActor, actorId ?? '');
}

/**
 * Which character a user is voicing: the token they control, otherwise the
 * character assigned to them.
 */
export function getPersona(user: FoundryUser): string | null {
  return getActiveActorId(user) ?? user.character?.id ?? null;
}
