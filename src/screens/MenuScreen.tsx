import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Languages, ScanLine, SearchX, Settings2, TriangleAlert } from 'lucide-react';
import type { Dietary, FoodCategory, MenuItem, TargetLanguageCode } from '../lib/types';
import { evaluateItem, hasActivePreferences, type MatchResult } from '../lib/matching';
import { isUntranslated } from '../lib/pipeline';
import { TARGET_LANGUAGES, targetName } from '../lib/languages';
import { Badge, Button, ConfidenceTag, formatDate } from '../components/ui';
import { EmptyState, InfoNote, SafetyNotice } from '../components/Feedback';
import { CategoryFilter, DietaryFilter, SearchBar } from '../components/Filters';
import { MenuItemCard, PendingDishCard } from '../components/MenuItemCard';
import { DishDetails } from '../components/DishDetails';
import { Recommendations } from '../components/Recommendations';
import { Modal } from '../components/Modal';
import { DEMO_MENU_ID } from '../data/sampleMenu';
import { navigate } from '../state/router';
import { useStore } from '../state/store';

type CategoryFilterValue = 'All' | FoodCategory;
type DietFilterValue = 'All' | Dietary;
type SortValue = 'menu' | 'price-asc' | 'price-desc' | 'spice-asc' | 'match';

const CATEGORIES: CategoryFilterValue[] = ['All', 'Breakfast', 'Main Course', 'Snacks', 'Desserts', 'Beverages', 'Other'];
const DIETS: DietFilterValue[] = ['All', 'Vegetarian', 'Vegan', 'Non-vegetarian', 'Unknown'];
const SPICE_RANK = { Mild: 1, Medium: 2, Spicy: 3, 'Very spicy': 4, Unknown: 9 } as const;
const MATCH_RANK = { match: 0, neutral: 1, caution: 2 } as const;

/** Lower-cases and strips Latin diacritics so "creme" finds "crème". Non-Latin scripts are untouched. */
function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase().trim();
}

function matchesDiet(item: MenuItem, f: DietFilterValue) {
  if (f === 'All') return true;
  // Vegan dishes are also vegetarian.
  if (f === 'Vegetarian') return item.dietaryClassification === 'Vegetarian' || item.dietaryClassification === 'Vegan';
  return item.dietaryClassification === f;
}

export function MenuScreen() {
  const { activeMenuId, getMenu, prefs, setPrefs, isFavourite, toggleFavourite, consumePendingDish, pendingDishId, backend, startJob, translateDish, dishStatus } = useStore();
  const menu = getMenu(activeMenuId);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<CategoryFilterValue>('All');
  const [diet, setDiet] = useState<DietFilterValue>('All');
  const [sort, setSort] = useState<SortValue>('menu');
  const [selected, setSelected] = useState<string | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [retranslateOpen, setRetranslateOpen] = useState(false);
  const [newTarget, setNewTarget] = useState<TargetLanguageCode>(prefs.targetLanguage);

  useEffect(() => {
    const d = consumePendingDish();
    // Only explained dishes have details to show; untranslated ones show their card instead.
    const item = d ? menu?.items.find((i) => i.id === d) : null;
    if (item && !isUntranslated(item)) setSelected(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDishId]);

  const prefsActive = hasActivePreferences(prefs);
  const matches = useMemo(() => {
    const m = new Map<string, MatchResult>();
    if (menu && prefsActive) menu.items.forEach((i) => !isUntranslated(i) && m.set(i.id, evaluateItem(i, prefs)));
    return m;
  }, [menu, prefs, prefsActive]);

  const visible = useMemo(() => {
    if (!menu) return [];
    const q = norm(query);
    const list = menu.items.filter(
      (i) =>
        (cat === 'All' || i.foodCategory === cat) &&
        matchesDiet(i, diet) &&
        (!q || [i.originalName, i.translatedName, i.transliteration ?? ''].some((s) => norm(s).includes(q))),
    );
    const byPrice = (a: MenuItem, b: MenuItem, dir: 1 | -1) =>
      a.priceINR === null ? 1 : b.priceINR === null ? -1 : (a.priceINR - b.priceINR) * dir;
    const sorted = [...list];
    if (sort === 'price-asc') sorted.sort((a, b) => byPrice(a, b, 1));
    if (sort === 'price-desc') sorted.sort((a, b) => byPrice(a, b, -1));
    if (sort === 'spice-asc') sorted.sort((a, b) => SPICE_RANK[a.spiceLevel] - SPICE_RANK[b.spiceLevel]);
    if (sort === 'match') sorted.sort((a, b) => MATCH_RANK[matches.get(a.id)?.level ?? 'neutral'] - MATCH_RANK[matches.get(b.id)?.level ?? 'neutral']);
    return sorted;
  }, [menu, query, cat, diet, sort, matches]);

  if (!menu) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <EmptyState
          icon={<BookOpen size={28} aria-hidden="true" />}
          title="No menu open"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => navigate('upload')}>Translate a menu</Button>
              <Button variant="secondary" onClick={() => navigate('saved')}>
                My Menus
              </Button>
            </div>
          }
        >
          This menu may have been deleted, or browser data was cleared.
        </EmptyState>
      </div>
    );
  }

  const selectedItem = menu.items.find((i) => i.id === selected && !isUntranslated(i)) ?? null;
  const reviewCount = menu.items.filter((i) => i.needsReview).length;
  const untranslatedCount = menu.items.filter(isUntranslated).length;
  const explainedCount = menu.items.length - untranslatedCount;
  const explainedMenu = { ...menu, items: menu.items.filter((i) => !isUntranslated(i)) };
  const onTranslateDish = async (item: MenuItem) => {
    if (await translateDish(menu, item)) setSelected(item.id);
  };
  const missingPrices = menu.items.filter((i) => i.priceINR === null).length;
  const countFor = (c: CategoryFilterValue) => (c === 'All' ? menu.items.length : menu.items.filter((i) => i.foodCategory === c).length);
  const dietCount = (d: DietFilterValue) => menu.items.filter((i) => matchesDiet(i, d)).length;
  const filtersActive = query || cat !== 'All' || diet !== 'All';
  const clearFilters = () => (setQuery(''), setCat('All'), setDiet('All'));

  const prefSummary = [
    prefs.dietary !== 'none' && prefs.dietary.replace('-', ' '),
    prefs.spice !== 'none' && `${prefs.spice} spice`,
    prefs.avoid.length > 0 && `avoiding ${prefs.avoid.join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-8 md:py-10">
      {/* Summary */}
      <section className="card flex flex-wrap items-start gap-4 p-4 sm:flex-nowrap sm:items-center sm:p-5" aria-labelledby="menu-title">
        {menu.thumbnail ? (
          <button type="button" onClick={() => setImageOpen(true)} className="shrink-0 self-start rounded-lg" aria-label="View menu image">
            <img src={menu.thumbnail} alt="" className="h-20 w-16 rounded-lg object-cover ring-1 ring-line sm:h-24 sm:w-20" />
          </button>
        ) : (
          <div className="grid h-20 w-16 shrink-0 place-items-center rounded-lg bg-sage text-brand sm:h-24 sm:w-20" aria-hidden="true">
            <ScanLine size={26} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 id="menu-title" className="font-heading text-[24px] md:text-[28px]">
              {menu.isDemo ? 'Sample menu' : menu.title}
            </h1>
            {menu.isDemo && <Badge tone="accent">Demonstration data</Badge>}
            {!menu.isDemo && untranslatedCount > 0 && (
              <Badge tone="neutral">
                {explainedCount} of {menu.items.length} explained
              </Badge>
            )}
          </div>
          {menu.isDemo && <p className="mt-1 text-[14px] text-muted">Illustrative records written for this demo — not extracted from a real restaurant.</p>}
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[15px]">
            <div className="flex gap-1.5">
              <dt className="text-muted">From</dt>
              <dd className="font-medium">
                {menu.sourceLanguage}
                {!menu.isDemo && (
                  <span className="ml-2 align-middle">
                    <ConfidenceTag value={menu.sourceLanguageConfidence} label="Language detection" />
                  </span>
                )}
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Into</dt>
              <dd className="font-medium">{targetName(menu.targetLanguage)}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-muted">Dishes</dt>
              <dd className="font-medium">{menu.items.length}</dd>
            </div>
            {!menu.isDemo && menu.model && (
              <div className="flex gap-1.5">
                <dt className="text-muted">Read by</dt>
                <dd>{menu.model}</dd>
              </div>
            )}
            {!menu.isDemo && (
              <div className="flex gap-1.5">
                <dt className="text-muted">Translated</dt>
                <dd>{formatDate(menu.createdAt)}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
          {menu.isDemo ? (
            <div>
              <label htmlFor="demo-lang" className="mb-1 block text-[13px] font-semibold text-ink/70">
                Show in
              </label>
              <select
                id="demo-lang"
                value={menu.targetLanguage}
                onChange={(e) => setPrefs({ targetLanguage: e.target.value as TargetLanguageCode })}
                className="h-11 rounded-xl border border-line bg-white px-3 text-base"
              >
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setNewTarget(TARGET_LANGUAGES.find((l) => l.code !== menu.targetLanguage)!.code);
                setRetranslateOpen(true);
              }}
            >
              <Languages size={16} aria-hidden="true" /> Other language
            </Button>
          )}
        </div>
      </section>

      <div className="mt-4 grid gap-3">
        {!menu.isDemo && untranslatedCount > 0 && (
          <InfoNote>
            <strong>{explainedCount === 0 ? `${menu.items.length} dishes found.` : `${explainedCount} of ${menu.items.length} dishes explained.`}</strong> Tap{' '}
            <strong>Translate this dish</strong> on any dish to see what it is. MenuMate explains one dish at a time to stay within the free AI limit. Names in
            English letters show how a dish is pronounced.
          </InfoNote>
        )}
        <SafetyNotice compact />
        {(reviewCount > 0 || missingPrices > 0 || menu.notes.length > 0) && (
          <InfoNote>
            {reviewCount > 0 && <p>{reviewCount} item(s) were hard to read and are marked for review — compare them with the printed menu.</p>}
            {missingPrices > 0 && <p>{missingPrices} price(s) couldn’t be read and are shown as “Price not readable” rather than guessed.</p>}
            {menu.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </InfoNote>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
        {/* Filters */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start" aria-label="Search and filters">
          <div className="grid gap-5 lg:rounded-2xl lg:bg-white lg:p-5 lg:shadow-card">
            <SearchBar value={query} onChange={setQuery} />
            <CategoryFilter label="Food category" value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c, label: c === 'Other' ? 'Other / Unknown' : c, count: countFor(c) }))} />
            <DietaryFilter label="Dietary (estimated)" value={diet} onChange={setDiet} options={DIETS.map((d) => ({ value: d, label: d, count: dietCount(d) }))} />
            <div className="hidden rounded-xl bg-sage p-3.5 text-[14px] lg:block">
              {prefsActive ? (
                <p>
                  Highlighting dishes for: <strong>{prefSummary}</strong>.
                </p>
              ) : (
                <p>Set food preferences to highlight dishes that may suit you.</p>
              )}
              <button type="button" onClick={() => navigate('preferences')} className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 font-medium text-brand underline-offset-4 hover:underline">
                <Settings2 size={15} aria-hidden="true" /> {prefsActive ? 'Edit preferences' : 'Set preferences'}
              </button>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0">
          {explainedMenu.items.length >= 2 && <Recommendations menu={explainedMenu} onOpen={(item) => setSelected(item.id)} />}
          <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-[15px] text-ink/75" aria-live="polite">
              Showing <strong className="text-ink">{visible.length}</strong> of {menu.items.length} dishes
              {filtersActive && (
                <button type="button" onClick={clearFilters} className="ml-3 min-h-10 font-medium text-brand underline-offset-4 hover:underline">
                  Clear filters
                </button>
              )}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-[14px] font-medium text-ink/75">
                Sort
              </label>
              <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortValue)} className="h-11 rounded-xl border border-line bg-white px-3 text-base">
                <option value="menu">Menu order</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="spice-asc">Mildest first</option>
                {prefsActive && <option value="match">Best match for me</option>}
              </select>
            </div>
          </div>
          <p className="mb-3 text-[14px] text-ink/75 lg:hidden">
            {prefsActive ? <>Highlighting: {prefSummary}. </> : null}
            <button type="button" onClick={() => navigate('preferences')} className="min-h-10 font-medium text-brand underline underline-offset-4">
              {prefsActive ? 'Edit preferences' : 'Set food preferences to highlight dishes'}
            </button>
          </p>
          {visible.length === 0 ? (
            <EmptyState icon={<SearchX size={28} aria-hidden="true" />} title="No dishes match" action={<Button onClick={clearFilters}>Clear search and filters</Button>}>
              Try another spelling, or search using the name in the original script.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {visible.map((item) => (
                <li key={item.id} className="flex">
                  {isUntranslated(item) ? (
                    <PendingDishCard
                      item={item}
                      currency={menu.currency}
                      sourceLanguage={menu.sourceLanguage}
                      favourite={isFavourite(menu.id, item.id)}
                      onToggleFavourite={() => toggleFavourite(menu, item)}
                      onTranslate={() => void onTranslateDish(item)}
                      status={dishStatus[`${menu.id}:${item.id}`]}
                      canTranslate={!!backend?.configured}
                    />
                  ) : (
                  <MenuItemCard
                      item={item}
                      currency={menu.currency}
                      sourceLanguage={menu.sourceLanguage}
                      favourite={isFavourite(menu.id, item.id)}
                      onToggleFavourite={() => toggleFavourite(menu, item)}
                      onOpen={() => setSelected(item.id)}
                    match={matches.get(item.id) ?? null}
                  />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DishDetails menu={menu} item={selectedItem} open={!!selectedItem} onClose={() => setSelected(null)} match={selectedItem ? (matches.get(selectedItem.id) ?? null) : null} />

      <Modal open={imageOpen} onClose={() => setImageOpen(false)} title="Menu image" size="lg">
        {menu.thumbnail && <img src={menu.thumbnail} alt={`${menu.isDemo ? 'Sample' : 'Uploaded'} menu image`} className="mx-auto mt-4 max-h-[75vh] w-auto rounded-lg" />}
        {!menu.isDemo && <p className="mt-3 text-center text-[14px] text-muted">Only a small thumbnail is saved on this device; the full photo is not stored.</p>}
      </Modal>

      <Modal open={retranslateOpen} onClose={() => setRetranslateOpen(false)} title="Translate into another language" size="sm">
        <p className="pt-4 text-[15px] text-ink/80">
          We’ll translate the {explainedCount} dish{explainedCount === 1 ? '' : 'es'} you’ve already explained, reusing the names and prices read from this
          menu — no photo needed. The new version is saved alongside this one.
        </p>
        <label htmlFor="retranslate-lang" className="mt-4 block text-[14px] font-semibold">
          Language
        </label>
        <select id="retranslate-lang" value={newTarget} onChange={(e) => setNewTarget(e.target.value as TargetLanguageCode)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 text-base">
          {TARGET_LANGUAGES.filter((l) => l.code !== menu.targetLanguage).map((l) => (
            <option key={l.code} value={l.code}>
              {l.native}
            </option>
          ))}
        </select>
        {!backend?.configured && (
          <p className="mt-3 flex items-start gap-2 text-[14px] text-accent-ink">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> Needs the live AI service, which isn’t configured on this site.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRetranslateOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!backend?.configured || newTarget === menu.targetLanguage || explainedCount === 0}
            onClick={() => {
              setRetranslateOpen(false);
              startJob({ kind: 'retranslate', menu, target: newTarget });
            }}
          >
            Translate
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export { DEMO_MENU_ID };
