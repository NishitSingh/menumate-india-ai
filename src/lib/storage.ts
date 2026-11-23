// localStorage persistence. Every access is wrapped: storage can be disabled,
// full, or cleared by the browser at any time, and the app must keep working.

import type { Favourite, SavedMenu, UserPreferences } from './types';
import { isTargetCode } from './languages';

const KEYS = {
  prefs: 'menumate.prefs.v1',
  menus: 'menumate.menus.v1',
  favourites: 'menumate.favourites.v1',
  lastMenu: 'menumate.lastMenu.v1',
} as const;

export const MAX_SAVED_MENUS = 20;

export const DEFAULT_PREFS: UserPreferences = {
  targetLanguage: 'en',
  dietary: 'none',
  spice: 'none',
  avoid: [],
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the write failed (quota exceeded, storage disabled). */
function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function storageAvailable(): boolean {
  try {
    const k = '__menumate_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadPrefs(): UserPreferences {
  const p = read<Partial<UserPreferences>>(KEYS.prefs, {});
  return {
    targetLanguage: isTargetCode(p.targetLanguage) ? p.targetLanguage : DEFAULT_PREFS.targetLanguage,
    dietary: ['none', 'vegetarian', 'vegan', 'dairy-free'].includes(p.dietary as string)
      ? (p.dietary as UserPreferences['dietary'])
      : 'none',
    spice: ['none', 'mild', 'medium', 'spicy'].includes(p.spice as string)
      ? (p.spice as UserPreferences['spice'])
      : 'none',
    avoid: Array.isArray(p.avoid) ? p.avoid.filter((a) => typeof a === 'string').slice(0, 20) : [],
  };
}
export const savePrefs = (p: UserPreferences) => write(KEYS.prefs, p);

export function loadMenus(): SavedMenu[] {
  const m = read<SavedMenu[]>(KEYS.menus, []);
  return Array.isArray(m) ? m.filter((x) => x && typeof x.id === 'string' && Array.isArray(x.items)) : [];
}
export const saveMenus = (m: SavedMenu[]) => write(KEYS.menus, m);

export function loadFavourites(): Favourite[] {
  const f = read<Favourite[]>(KEYS.favourites, []);
  return Array.isArray(f) ? f.filter((x) => x && typeof x.itemId === 'string') : [];
}
export const saveFavourites = (f: Favourite[]) => write(KEYS.favourites, f);

export const loadLastMenuId = () => read<string | null>(KEYS.lastMenu, null);
export const saveLastMenuId = (id: string | null) => write(KEYS.lastMenu, id);

export function clearAllData(): boolean {
  try {
    Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
    return true;
  } catch {
    return false;
  }
}
