import { useState } from 'react';
import { Lightbulb, LoaderCircle, RefreshCw, X } from 'lucide-react';
import type { MenuItem, Recommendation, SavedMenu } from '../lib/types';
import { ApiError, recommendDishes } from '../lib/api';
import { hasActivePreferences, localRecommendations } from '../lib/matching';
import { navigate } from '../state/router';
import { useStore } from '../state/store';
import { Button } from './ui';

export function Recommendations({ menu, onOpen }: { menu: SavedMenu; onOpen: (item: MenuItem) => void }) {
  const { prefs, backend } = useStore();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [source, setSource] = useState<'ai' | 'rules'>('rules');
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setState('loading');
    setError(null);
    const useAI = !menu.isDemo && backend?.configured;
    try {
      if (useAI) {
        setRecs(await recommendDishes(menu.items, prefs, menu.targetLanguage));
        setSource('ai');
      } else {
        setRecs(localRecommendations(menu.items, prefs));
        setSource('rules');
      }
      setState('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t get suggestions.');
      setState('error');
    }
  };

  if (state === 'idle') {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
            <Lightbulb size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">Not sure what to order?</p>
            <p className="text-[14px] text-muted">
              {hasActivePreferences(prefs) ? 'Get up to 3 suggestions based on your food preferences.' : 'Get up to 3 suggestions. Set food preferences for better picks.'}
            </p>
          </div>
        </div>
        <Button variant="accent" onClick={() => void run()}>
          Suggest dishes
        </Button>
      </div>
    );
  }

  const byId = new Map(menu.items.map((i) => [i.id, i]));
  return (
    <section className="rounded-2xl bg-white p-4 shadow-card sm:p-5" aria-labelledby="recs-title" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recs-title" className="flex items-center gap-2 font-heading text-lg">
          <Lightbulb size={20} className="text-accent-ink" aria-hidden="true" /> Suggested for you
        </h2>
        <button type="button" onClick={() => setState('idle')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-sage" aria-label="Close suggestions">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {state === 'loading' && (
        <p className="mt-3 flex items-center gap-2 text-[15px]">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Finding dishes that may suit you…
        </p>
      )}
      {state === 'error' && (
        <div className="mt-3">
          <p className="text-[15px] text-danger">{error}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => void run()}>
            <RefreshCw size={15} aria-hidden="true" /> Try again
          </Button>
        </div>
      )}
      {state === 'done' && (
        <>
          {recs.length === 0 ? (
            <p className="mt-3 text-[15px] text-ink/85">
              No dishes on this menu look like a good fit for your preferences. Try relaxing a preference, or ask the staff for advice.
            </p>
          ) : (
            <ol className="mt-3 grid gap-3 md:grid-cols-3">
              {recs.map((r, i) => {
                const item = byId.get(r.itemId);
                if (!item) return null;
                return (
                  <li key={r.itemId} className="flex flex-col rounded-xl bg-cream p-4">
                    <span className="text-[13px] font-semibold text-brand">Suggestion {i + 1}</span>
                    <span className="font-heading text-[17px]">{item.translatedName}</span>
                    <p className="mt-1 text-[14px] text-ink/85">{r.reason}</p>
                    {r.caution && <p className="mt-1 text-[13px] text-accent-ink">{r.caution}</p>}
                    <button type="button" onClick={() => onOpen(item)} className="mt-auto min-h-11 self-start pt-2 font-medium text-brand underline-offset-4 hover:underline">
                      View details
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-3 text-[13px] text-muted">
            {source === 'ai'
              ? 'Suggested by AI from this menu’s items and your preferences. Not a guarantee of suitability.'
              : 'Rule-based suggestions from the estimates on this menu (no AI used). Not a guarantee of suitability.'}{' '}
            <button type="button" onClick={() => navigate('preferences')} className="font-medium text-brand underline underline-offset-4">
              Edit preferences
            </button>
          </p>
        </>
      )}
    </section>
  );
}
