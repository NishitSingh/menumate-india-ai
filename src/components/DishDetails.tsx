import { useState, type ReactNode } from 'react';
import { BookOpen, ChefHat, CircleAlert, Leaf, LoaderCircle, RefreshCw, ScrollText, TriangleAlert } from 'lucide-react';
import type { MenuItem, SavedMenu } from '../lib/types';
import { explainDish, ApiError } from '../lib/api';
import { langTagFor } from '../lib/languages';
import type { MatchResult } from '../lib/matching';
import { useStore } from '../state/store';
import { Modal } from './Modal';
import { FoodIllustration } from './Illustrations';
import { DietaryBadge, FavouriteButton, PriceTag, SpiceIndicator } from './MenuItemCard';
import { SafetyNotice } from './Feedback';
import { Badge, Button, ConfidenceTag, EstimateLabel, cx } from './ui';

function Section({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="border-t border-line/70 pt-5">
      <h3 className="mb-2 flex items-center gap-2 font-heading text-[16px]">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function ExplainPanel({ menu, item }: { menu: SavedMenu; item: MenuItem }) {
  const { backend, setItemExplanation } = useStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = item.explanation;
  const canFetch = !menu.isDemo && backend?.configured;

  const load = async () => {
    setOpen(true);
    if (e || menu.isDemo) return;
    if (!canFetch) {
      setError('Explanations need the live AI service, which isn’t configured on this site.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const exp = await explainDish(item, menu.sourceLanguage, menu.targetLanguage);
      setItemExplanation(menu.id, item.id, exp);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t load the explanation.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button variant="accent" onClick={() => void load()} className="w-full sm:w-auto">
        <BookOpen size={18} aria-hidden="true" />
        Explain this dish
      </Button>
    );
  }

  return (
    <div className="rounded-2xl bg-sage p-4 sm:p-5" aria-live="polite">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-heading text-[17px]">About this dish</h3>
        <EstimateLabel demo={menu.isDemo} />
      </div>
      {loading && (
        <p className="flex items-center gap-2 text-[15px]">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Asking the AI to explain {item.translatedName}…
        </p>
      )}
      {error && (
        <div className="text-[15px]">
          <p className="flex items-start gap-2 text-danger">
            <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
          </p>
          {canFetch && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => void load()}>
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </Button>
          )}
        </div>
      )}
      {e && (
        <dl className="grid gap-3 text-[15px] leading-relaxed">
          {[
            ['What it is', e.whatItIs],
            ['Taste', e.taste],
            ['Texture', e.texture],
            ['How it’s usually made', e.preparation],
          ]
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] font-semibold text-brand">{k}</dt>
                <dd className="text-ink/90">{v}</dd>
              </div>
            ))}
          {e.origin && (
            <div>
              <dt className="flex items-center gap-2 text-[13px] font-semibold text-brand">Regional origin</dt>
              <dd className="text-ink/90">{e.origin}</dd>
              <dd className="mt-1">
                <ConfidenceTag value={e.originConfidence} label="Origin" />
              </dd>
            </div>
          )}
        </dl>
      )}
      {e && <p className="mt-3 text-[13px] text-ink/70">Describes how this dish is typically made — this restaurant’s recipe may differ.</p>}
    </div>
  );
}

export function DishDetails({
  menu,
  item,
  open,
  onClose,
  match,
}: {
  menu: SavedMenu;
  item: MenuItem | null;
  open: boolean;
  onClose: () => void;
  match: MatchResult | null;
}) {
  const { isFavourite, toggleFavourite } = useStore();
  if (!item) return null;
  const demo = menu.isDemo;
  const englishOnlyDemo = demo && menu.targetLanguage !== 'en';
  const certaintyTone = { 'listed on menu': 'brand', likely: 'neutral', possible: 'outline' } as const;

  return (
    <Modal open={open} onClose={onClose} title={item.translatedName} size="lg" hideTitle>
      <div className="grid gap-5 pt-1 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-start">
        <div className="min-w-0">
          <p lang={langTagFor(menu.sourceLanguage)} className="text-lg text-muted">
            {item.originalName}
          </p>
          <h2 className="font-heading text-[26px] leading-tight sm:text-[30px]" aria-hidden="true">
            {item.translatedName}
          </h2>
          {item.transliteration && item.transliteration !== item.translatedName && <p className="mt-1 text-[15px] text-muted">Pronounced: {item.transliteration}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PriceTag item={item} currency={menu.currency} />
            <FavouriteButton active={isFavourite(menu.id, item.id)} onToggle={() => toggleFavourite(menu, item)} name={item.translatedName} size="lg" />
          </div>
        </div>
        <FoodIllustration category={item.foodCategory} className="hidden h-[140px] w-[140px] sm:block" />
      </div>

      {/* Confirmed menu information */}
      <div className="mt-5 rounded-xl border border-line p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-brand">
          <ScrollText size={16} aria-hidden="true" />
          {demo ? 'From the sample menu (demonstration data)' : 'Read from the menu photo'}
        </p>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[15px]">
          <dt className="text-muted">Name</dt>
          <dd lang={langTagFor(menu.sourceLanguage)}>{item.originalName}</dd>
          <dt className="text-muted">Price</dt>
          <dd>
            {item.priceText ?? 'Not readable on the menu'}
            {!demo && item.priceINR !== null && item.priceConfidence !== 'high' && <span className="ml-2 text-[13px] text-accent-ink">(check against the menu)</span>}
          </dd>
          {item.originalCategory && (
            <>
              <dt className="text-muted">Section</dt>
              <dd lang={langTagFor(menu.sourceLanguage)}>{item.originalCategory}</dd>
            </>
          )}
        </dl>
        {item.needsReview && (
          <p className="mt-3 flex items-start gap-2 text-[14px] text-accent-ink">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {item.reviewNote ?? 'Some text was hard to read. Compare with the printed menu.'}
          </p>
        )}
      </div>

      {match && match.level !== 'neutral' && (
        <div className={cx('mt-4 rounded-xl p-4 text-[15px]', match.level === 'match' ? 'bg-brand/10' : 'bg-accent-soft')}>
          <p className={cx('flex items-center gap-2 font-semibold', match.level === 'match' ? 'text-brand' : 'text-accent-ink')}>
            {match.level === 'match' ? <Leaf size={17} aria-hidden="true" /> : <TriangleAlert size={17} aria-hidden="true" />}
            {match.level === 'match' ? 'Possible match for your preferences' : 'Check before ordering'}
          </p>
          <ul className="mt-1 list-disc pl-6">
            {[...match.cautions, ...match.reasons].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-ink/70">Based on estimates, not a guarantee.</p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="font-heading text-lg">What to expect</h3>
        <EstimateLabel demo={demo} />
      </div>
      {englishOnlyDemo && <p className="mt-1 text-[13px] text-muted">Demo detail notes are in English. Live translations generate them in your chosen language.</p>}
      <div className="mt-3 grid gap-5">
        {item.description && <p className="text-[16px] leading-relaxed text-ink/90">{item.description}</p>}

        <ExplainPanel key={`${menu.id}-${item.id}`} menu={menu} item={item} />

        <Section title="Spice level">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <SpiceIndicator level={item.spiceLevel} />
            <ConfidenceTag value={item.spiceConfidence} label="Spice estimate" />
          </div>
          <p className="mt-1 text-[14px] text-muted">Estimated. Kitchens often adjust heat on request — ask for “less spicy” if unsure.</p>
        </Section>

        <Section title="Dietary classification">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <DietaryBadge value={item.dietaryClassification} />
            <ConfidenceTag value={item.dietaryConfidence} label="Dietary estimate" />
          </div>
          {item.dietaryNote && <p className="mt-2 text-[15px] text-ink/85">{item.dietaryNote}</p>}
        </Section>

        <Section title="Likely ingredients" icon={<ChefHat size={18} className="text-brand" aria-hidden="true" />}>
          {item.ingredients.length ? (
            <>
              <ul className="flex flex-wrap gap-2">
                {item.ingredients.map((ing) => (
                  <li key={ing.name}>
                    <Badge tone={certaintyTone[ing.certainty]}>
                      {ing.name}
                      <span className="font-normal opacity-75">· {ing.certainty}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-muted">“Listed on menu” means the ingredient appears in the dish name. Others are typical-recipe estimates.</p>
            </>
          ) : (
            <p className="text-[15px] text-muted">No ingredient estimate available.</p>
          )}
        </Section>

        {item.preparationMethod && (
          <Section title="Typical preparation">
            <p className="text-[15px] leading-relaxed text-ink/90">{item.preparationMethod}</p>
          </Section>
        )}

        <Section title="Potential allergens">
          {item.allergenWarnings.length ? (
            <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink/90 marker:text-accent">
              {item.allergenWarnings.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-ink/85">No specific allergens were identified. This does not mean the dish is allergen-free.</p>
          )}
        </Section>

        {item.culinaryTerms.length > 0 && (
          <Section title="Food words explained">
            <dl className="grid gap-2 text-[15px]">
              {item.culinaryTerms.map((t) => (
                <div key={t.term}>
                  <dt className="inline font-semibold">{t.term}: </dt>
                  <dd className="inline text-ink/85">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {item.flags.length > 0 && (
          <Section title="Notes about this result">
            <ul className="list-disc pl-5 text-[14px] text-ink/80">
              {item.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Section>
        )}

        <SafetyNotice />
      </div>
    </Modal>
  );
}
