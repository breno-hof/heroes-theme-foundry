import { MOODS, MoodSchema } from '@breno-hof/heroes-theme-core';
import { getMood, setMood } from './flags.js';
import { linkedUserIds } from './settings.js';
import { ThemeSetApp } from './theme-set-app.js';

const WIDGET_CLASS = 'heroes-theme-mood';

/**
 * Adds a mood picker and a "my themes" button to the bottom of the Players
 * list, for users the GM has linked to a Discord account.
 */
export function registerMoodWidget(): void {
  Hooks.on('renderPlayers', () => mountMoodWidget());
}

/**
 * Put the widget in the Players list if this user is linked, remove it if
 * not. Safe to call at any time: the list is found by its element ID, so this
 * works whether or not the render hook above fired.
 */
export function mountMoodWidget(): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('players');
  if (root === null) return;
  const existing = root.querySelector(`.${WIDGET_CLASS}`);
  const linked = linkedUserIds().includes(game.user.id);
  if (!linked) existing?.remove();
  else if (existing === null) root.append(buildWidget());
}

function buildWidget(): HTMLElement {
  const container = document.createElement('div');
  container.className = WIDGET_CLASS;

  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-music';
  icon.title = game.i18n.localize('HEROESTHEME.Themes.Mood');

  const select = document.createElement('select');
  select.ariaLabel = game.i18n.localize('HEROESTHEME.Themes.Mood');
  const current = getMood(game.user);
  for (const mood of MOODS) {
    const option = document.createElement('option');
    option.value = mood;
    option.textContent = game.i18n.localize(`HEROESTHEME.Mood.${mood}`);
    option.selected = mood === current;
    select.append(option);
  }
  select.addEventListener('change', () => {
    const mood = MoodSchema.safeParse(select.value);
    if (mood.success) void setMood(game.user, mood.data);
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.title = game.i18n.localize('HEROESTHEME.Themes.TitleUser');
  button.innerHTML = '<i class="fa-solid fa-sliders"></i>';
  button.addEventListener('click', () => {
    void new ThemeSetApp({ kind: 'user', user: game.user }).render({ force: true });
  });

  container.append(icon, select, button);
  return container;
}
