import { useState, type FormEvent } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import type { DietaryPreference, SpicePreference } from '../lib/types';
import { TARGET_LANGUAGES } from '../lib/languages';
import { Button, PageHeader, cx } from '../components/ui';
import { InfoNote, SafetyNotice } from '../components/Feedback';
import { ConfirmationModal } from '../components/Modal';
import { useStore } from '../state/store';

function RadioCards<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  description,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  description?: string;
}) {
  return (
    <fieldset className="card min-w-0 p-5">
      <legend className="sr-only">{legend}</legend>
      <h2 className="font-heading text-lg" aria-hidden="true">
        {legend}
      </h2>
      {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={cx(
                'flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-2 ring-1 ring-inset has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
                checked ? 'bg-brand/8 ring-2 ring-brand' : 'bg-white ring-line hover:bg-sage',
              )}
            >
              <input type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="sr-only" />
              <span>
                <span className="block font-medium">{o.label}</span>
                {o.hint && <span className="block text-[13px] text-muted">{o.hint}</span>}
              </span>
              <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full', checked ? 'bg-brand text-white' : 'ring-1 ring-line')} aria-hidden="true">
                {checked && <Check size={15} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PreferenceSettings() {
  const { prefs, setPrefs } = useStore();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addIngredient = (e: FormEvent) => {
    e.preventDefault();
    const terms = draft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!terms.length) {
      setError('Type an ingredient, e.g. peanuts.');
      return;
    }
    const bad = terms.find((t) => t.length > 40);
    if (bad) {
      setError('Please keep each ingredient under 40 characters.');
      return;
    }
    const existing = new Set(prefs.avoid.map((a) => a.toLowerCase()));
    const fresh = terms.filter((t) => !existing.has(t.toLowerCase()));
    if (prefs.avoid.length + fresh.length > 20) {
      setError('You can add up to 20 ingredients.');
      return;
    }
    setPrefs({ avoid: [...prefs.avoid, ...fresh] });
    setDraft('');
    setError(null);
  };

  return (
    <div className="grid gap-5">
      <RadioCards
        legend="Translate menus into"
        name="target"
        value={prefs.targetLanguage}
        onChange={(v) => setPrefs({ targetLanguage: v })}
        options={TARGET_LANGUAGES.map((l) => ({ value: l.code, label: l.native, hint: l.native !== l.name ? l.name : undefined }))}
      />
      <RadioCards<DietaryPreference>
        legend="Dietary preference"
        name="dietary"
        value={prefs.dietary}
        onChange={(v) => setPrefs({ dietary: v })}
        options={[
          { value: 'none', label: 'No preference' },
          { value: 'vegetarian', label: 'Vegetarian' },
          { value: 'vegan', label: 'Vegan', hint: 'No dairy, eggs, meat or fish' },
          { value: 'dairy-free', label: 'Dairy-free' },
        ]}
      />
      <RadioCards<SpicePreference>
        legend="Spice preference"
        name="spice"
        value={prefs.spice}
        onChange={(v) => setPrefs({ spice: v })}
        options={[
          { value: 'none', label: 'No preference' },
          { value: 'mild', label: 'Mild' },
          { value: 'medium', label: 'Medium' },
          { value: 'spicy', label: 'Spicy' },
        ]}
      />

      <div className="card p-5">
        <h2 className="font-heading text-lg">Ingredients to avoid</h2>
        <p className="mt-1 text-[14px] text-muted">We’ll flag dishes whose estimated ingredients mention these. Groups like “nuts”, “dairy” or “gluten” also match common Indian ingredient names.</p>
        <form onSubmit={addIngredient} className="mt-4 flex gap-2" noValidate>
          <label htmlFor="avoid-input" className="sr-only">
            Ingredient to avoid
          </label>
          <input
            id="avoid-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. peanuts, coriander"
            aria-invalid={!!error}
            aria-describedby={error ? 'avoid-error' : undefined}
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-base"
          />
          <Button type="submit" className="shrink-0">
            <Plus size={18} aria-hidden="true" /> Add
          </Button>
        </form>
        {error && (
          <p id="avoid-error" className="mt-2 text-[14px] text-danger" role="alert">
            {error}
          </p>
        )}
        {prefs.avoid.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Ingredients you avoid">
            {prefs.avoid.map((a) => (
              <li key={a} className="flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3.5 pr-1 text-[15px] text-accent-ink">
                {a}
                <button
                  type="button"
                  onClick={() => setPrefs({ avoid: prefs.avoid.filter((x) => x !== a) })}
                  className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/60"
                  aria-label={`Remove ${a}`}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-muted">No ingredients added.</p>
        )}
      </div>
    </div>
  );
}

export function PreferencesScreen() {
  const { menus, favourites, resetPrefs, deleteAllMenus, clearFavourites, notify, storageOk } = useStore();
  const [confirm, setConfirm] = useState<null | 'menus' | 'favs' | 'prefs'>(null);

  const actions = {
    menus: { title: 'Delete all saved menus?', message: 'This removes every translated menu and its favourites from this browser. It can’t be undone.', label: 'Delete menus', run: () => (deleteAllMenus(), notify('All saved menus deleted')) },
    favs: { title: 'Clear all favourites?', message: 'This removes every favourite dish from this browser.', label: 'Clear favourites', run: () => (clearFavourites(), notify('Favourites cleared')) },
    prefs: { title: 'Reset preferences?', message: 'Your language, dietary, spice and ingredient settings return to defaults.', label: 'Reset', run: () => (resetPrefs(), notify('Preferences reset')) },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <PageHeader title="Food preferences" subtitle="Tell us how you eat, and we’ll highlight dishes that may suit you. Changes save automatically on this device." />
      {!storageOk && <InfoNote className="mb-5">This browser is blocking local storage, so preferences will reset when you close the tab.</InfoNote>}
      <PreferenceSettings />
      <SafetyNotice className="mt-5" />
      <p className="mt-3 text-[14px] text-ink/70">Highlights are hints based on estimates. They never guarantee that a dish meets a dietary restriction or is safe for an allergy.</p>

      <section className="mt-10" aria-labelledby="data-title">
        <h2 id="data-title" className="font-heading text-xl">
          Your data
        </h2>
        <p className="mt-1 text-[15px] text-ink/75">
          Everything is stored only in this browser on this device ({menus.length} saved menu{menus.length === 1 ? '' : 's'}, {favourites.length} favourite
          {favourites.length === 1 ? '' : 's'}). Clearing browser data or using private browsing will remove it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setConfirm('menus')} disabled={!menus.length}>
            <Trash2 size={16} aria-hidden="true" /> Delete saved menus
          </Button>
          <Button variant="secondary" onClick={() => setConfirm('favs')} disabled={!favourites.length}>
            <Trash2 size={16} aria-hidden="true" /> Clear favourites
          </Button>
          <Button variant="secondary" onClick={() => setConfirm('prefs')}>
            Reset preferences
          </Button>
        </div>
      </section>

      {confirm && (
        <ConfirmationModal
          open
          title={actions[confirm].title}
          message={actions[confirm].message}
          confirmLabel={actions[confirm].label}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            actions[confirm].run();
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
