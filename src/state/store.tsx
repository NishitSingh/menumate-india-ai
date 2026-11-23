import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DishExplanation, Favourite, MenuItem, SavedMenu, TargetLanguageCode, UserPreferences } from '../lib/types';
import { ApiError, translateItems } from '../lib/api';
import * as storage from '../lib/storage';
import { checkBackend, type BackendStatus } from '../lib/api';
import type { LoadedImage } from '../lib/image';
import { TranslationJob, isUntranslated, type JobInput, type JobState } from '../lib/pipeline';
import { buildSampleMenu, DEMO_MENU_ID } from '../data/sampleMenu';
import { navigate } from './router';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface Store {
  prefs: UserPreferences;
  setPrefs: (p: Partial<UserPreferences>) => void;
  resetPrefs: () => void;

  menus: SavedMenu[];
  getMenu: (id: string | null) => SavedMenu | null;
  deleteMenu: (id: string) => void;
  deleteAllMenus: () => void;
  setItemExplanation: (menuId: string, itemId: string, e: DishExplanation) => void;

  favourites: Favourite[];
  isFavourite: (menuId: string, itemId: string) => boolean;
  toggleFavourite: (menu: SavedMenu, item: MenuItem) => void;
  removeFavourite: (menuId: string, itemId: string) => void;
  clearFavourites: () => void;

  draft: LoadedImage | null;
  setDraft: (img: LoadedImage | null) => void;
  sourceHint: string | null;
  setSourceHint: (code: string | null) => void;

  activeMenuId: string | null;
  openMenu: (id: string, dishId?: string) => void;
  pendingDishId: string | null;
  consumePendingDish: () => string | null;

  backend: BackendStatus | null;
  refreshBackend: () => Promise<BackendStatus>;

  job: TranslationJob | null;
  jobState: JobState | null;
  startJob: (input: JobInput) => void;

  /** Translate ONE dish of a saved menu (1 small AI request). Resolves true on success. */
  translateDish: (menu: SavedMenu, item: MenuItem) => Promise<boolean>;
  dishStatus: Record<string, DishStatus>;

  storageOk: boolean;
  toasts: Toast[];
  notify: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

export type DishStatus = { state: 'loading' } | { state: 'waiting'; seconds: number } | { state: 'error'; message: string };

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [storageOk] = useState(storage.storageAvailable);
  const [prefs, setPrefsState] = useState<UserPreferences>(storage.loadPrefs);
  const [menus, setMenus] = useState<SavedMenu[]>(storage.loadMenus);
  const [favourites, setFavourites] = useState<Favourite[]>(storage.loadFavourites);
  const [draft, setDraftState] = useState<LoadedImage | null>(null);
  const [sourceHint, setSourceHint] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(storage.loadLastMenuId);
  const [pendingDishId, setPendingDishId] = useState<string | null>(null);
  const [backend, setBackend] = useState<BackendStatus | null>(null);
  const [job, setJob] = useState<TranslationJob | null>(null);
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dishStatus, setDishStatus] = useState<Record<string, DishStatus>>({});
  const toastId = useRef(0);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refreshBackend = useCallback(async () => {
    const s = await checkBackend();
    setBackend(s);
    return s;
  }, []);
  useEffect(() => {
    void refreshBackend();
  }, [refreshBackend]);

  // ---- preferences
  const setPrefs = useCallback((p: Partial<UserPreferences>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p };
      storage.savePrefs(next);
      return next;
    });
  }, []);
  const resetPrefs = useCallback(() => {
    storage.savePrefs(storage.DEFAULT_PREFS);
    setPrefsState(storage.DEFAULT_PREFS);
  }, []);

  // ---- menus
  const persistMenus = useCallback(
    (next: SavedMenu[]) => {
      if (storage.saveMenus(next)) return next;
      // Storage full: retry without thumbnails before giving up.
      const lean = next.map((m) => ({ ...m, thumbnail: null }));
      if (storage.saveMenus(lean)) {
        notify('Storage is nearly full, so menu thumbnails were removed.', 'info');
        return lean;
      }
      notify('Couldn’t save to this browser (storage full or disabled). The menu is available until you close the tab.', 'error');
      return next;
    },
    [notify],
  );

  const demoMenu = useMemo(() => buildSampleMenu(prefs.targetLanguage), [prefs.targetLanguage]);

  const getMenu = useCallback(
    (id: string | null) => (id === DEMO_MENU_ID ? demoMenu : (menus.find((m) => m.id === id) ?? null)),
    [menus, demoMenu],
  );

  const deleteMenu = useCallback(
    (id: string) => {
      setMenus((prev) => persistMenus(prev.filter((m) => m.id !== id)));
      setFavourites((prev) => {
        const next = prev.filter((f) => f.menuId !== id);
        storage.saveFavourites(next);
        return next;
      });
    },
    [persistMenus],
  );

  const deleteAllMenus = useCallback(() => {
    setMenus(persistMenus([]));
    setFavourites((prev) => {
      const next = prev.filter((f) => f.menuId === DEMO_MENU_ID);
      storage.saveFavourites(next);
      return next;
    });
  }, [persistMenus]);

  const setItemExplanation = useCallback(
    (menuId: string, itemId: string, e: DishExplanation) => {
      setMenus((prev) =>
        persistMenus(
          prev.map((m) => (m.id !== menuId ? m : { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, explanation: e } : i)) })),
        ),
      );
    },
    [persistMenus],
  );

  // ---- favourites
  const isFavourite = useCallback(
    (menuId: string, itemId: string) => favourites.some((f) => f.menuId === menuId && f.itemId === itemId),
    [favourites],
  );
  const toggleFavourite = useCallback(
    (menu: SavedMenu, item: MenuItem) => {
      const exists = favourites.some((f) => f.menuId === menu.id && f.itemId === item.id);
      const next = exists
        ? favourites.filter((f) => !(f.menuId === menu.id && f.itemId === item.id))
        : [
            {
              menuId: menu.id,
              itemId: item.id,
              savedAt: new Date().toISOString(),
              snapshot: { originalName: item.originalName, translatedName: item.translatedName, priceINR: item.priceINR },
            },
            ...favourites,
          ];
      const ok = storage.saveFavourites(next);
      setFavourites(next);
      notify(
        !ok ? 'Couldn’t save favourites in this browser.' : exists ? `Removed ${item.translatedName} from favourites` : `Saved ${item.translatedName} to favourites`,
        ok ? 'success' : 'error',
      );
    },
    [favourites, notify],
  );
  const removeFavourite = useCallback((menuId: string, itemId: string) => {
    setFavourites((prev) => {
      const next = prev.filter((f) => !(f.menuId === menuId && f.itemId === itemId));
      storage.saveFavourites(next);
      return next;
    });
  }, []);
  const clearFavourites = useCallback(() => {
    storage.saveFavourites([]);
    setFavourites([]);
  }, []);

  // ---- draft image (memory only)
  const setDraft = useCallback((img: LoadedImage | null) => {
    setDraftState((prev) => {
      if (prev && prev !== img) URL.revokeObjectURL(prev.url);
      return img;
    });
  }, []);

  const openMenu = useCallback((id: string, dishId?: string) => {
    setActiveMenuId(id);
    storage.saveLastMenuId(id);
    setPendingDishId(dishId ?? null);
    navigate('menu');
  }, []);
  const consumePendingDish = useCallback(() => {
    const d = pendingDishId;
    if (d) setPendingDishId(null);
    return d;
  }, [pendingDishId]);

  // ---- translation job
  const startJob = useCallback(
    (input: JobInput) => {
      job?.cancel();
      const j = new TranslationJob(input, setJobState, (menu) => {
        setMenus((prev) => persistMenus([menu, ...prev.filter((m) => m.id !== menu.id)].slice(0, storage.MAX_SAVED_MENUS)));
        setActiveMenuId(menu.id);
        storage.saveLastMenuId(menu.id);
        const missing = menu.items.filter(isUntranslated).length;
        const done = menu.items.length - missing;
        notify(
          missing === 0
            ? `Translated ${done} dish${done === 1 ? '' : 'es'}`
            : done === 0
              ? `Saved ${menu.items.length} dishes — tap any dish to translate it`
              : `Explained ${done} dish${done === 1 ? '' : 'es'} · ${missing} more available to translate`,
        );
      });
      setJob(j);
      setJobState(j.state);
      setPrefs({ targetLanguage: input.target as TargetLanguageCode });
      navigate('processing');
      void j.run();
    },
    [job, persistMenus, notify, setPrefs],
  );

  const translateDish = useCallback(
    async (menu: SavedMenu, item: MenuItem): Promise<boolean> => {
      const key = `${menu.id}:${item.id}`;
      const setStatus = (st: DishStatus | null) =>
        setDishStatus((prev) => {
          const next = { ...prev };
          if (st) next[key] = st;
          else delete next[key];
          return next;
        });
      const extracted = {
        id: item.id,
        order: item.order,
        originalName: item.originalName,
        transliteration: item.transliteration,
        originalCategory: item.originalCategory,
        priceText: item.priceText,
        price: item.priceINR,
        priceConfidence: item.priceConfidence,
        nameConfidence: item.nameConfidence,
        needsReview: item.needsReview,
        reviewNote: item.reviewNote,
      };
      for (let attempt = 0; attempt < 4; attempt++) {
        setStatus({ state: 'loading' });
        try {
          const [t] = await translateItems([extracted], menu.sourceLanguage, menu.targetLanguage);
          const merged: MenuItem = {
            ...item,
            ...t,
            // Menu facts always come from the original reading.
            id: item.id,
            originalName: item.originalName,
            priceINR: item.priceINR,
            priceText: item.priceText,
            transliteration: t.transliteration ?? item.transliteration,
            explanation: null,
          };
          setMenus((prev) =>
            persistMenus(
              prev.map((m) => {
                if (m.id !== menu.id) return m;
                const items = m.items.map((i) => (i.id === item.id ? merged : i));
                return { ...m, items, status: items.some(isUntranslated) ? 'partial' : 'complete' };
              }),
            ),
          );
          setStatus(null);
          return true;
        } catch (e) {
          const err = e instanceof ApiError ? e : new ApiError('INTERNAL', 'Couldn’t translate this dish.', true);
          const wait = err.code === 'RATE_LIMITED' ? (err.retryAfterSeconds ?? 30) : null;
          if (wait !== null && wait <= 180 && attempt < 3) {
            for (let sec = Math.ceil(wait) + 2; sec > 0; sec--) {
              setStatus({ state: 'waiting', seconds: sec });
              await new Promise((r) => setTimeout(r, 1000));
            }
            continue;
          }
          setStatus({ state: 'error', message: err.message });
          return false;
        }
      }
      return false;
    },
    [persistMenus],
  );

  const value: Store = {
    prefs, setPrefs, resetPrefs,
    menus, getMenu, deleteMenu, deleteAllMenus, setItemExplanation,
    favourites, isFavourite, toggleFavourite, removeFavourite, clearFavourites,
    draft, setDraft, sourceHint, setSourceHint,
    activeMenuId, openMenu, pendingDishId, consumePendingDish,
    backend, refreshBackend,
    job, jobState, startJob,
    translateDish, dishStatus,
    storageOk, toasts, notify, dismissToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
