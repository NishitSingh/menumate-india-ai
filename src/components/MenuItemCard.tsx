import { CircleAlert, CircleHelp, Drumstick, Flame, Heart, Languages, Leaf, LoaderCircle, Sprout, TriangleAlert } from 'lucide-react';
import type { DishStatus } from '../state/store';
import type { Confidence, Dietary, MenuItem, SpiceLevel } from '../lib/types';
import type { MatchResult } from '../lib/matching';
import { langTagFor } from '../lib/languages';
import { Badge, cx, formatPrice } from './ui';

const SPICE_LEVELS: Record<SpiceLevel, number> = { Mild: 1, Medium: 2, Spicy: 3, 'Very spicy': 4, Unknown: 0 };

export function SpiceIndicator({ level, confidence, showLabel = true }: { level: SpiceLevel; confidence?: Confidence; showLabel?: boolean }) {
  const n = SPICE_LEVELS[level];
  const label = level === 'Unknown' ? 'Spice unknown' : `${level}`;
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] text-ink" aria-label={`Estimated spice level: ${label}${confidence ? `, ${confidence} confidence` : ''}`}>
      <span aria-hidden="true" className="inline-flex">
        {[1, 2, 3, 4].map((i) => (
          <Flame key={i} size={15} strokeWidth={2.2} className={i <= n ? 'fill-accent text-accent' : 'text-line'} />
        ))}
      </span>
      {showLabel && <span aria-hidden="true">{label}</span>}
    </span>
  );
}

export function DietaryBadge({ value, confidence }: { value: Dietary; confidence?: Confidence }) {
  const map = {
    Vegetarian: { icon: Leaf, tone: 'brand' as const },
    Vegan: { icon: Sprout, tone: 'brand' as const },
    'Non-vegetarian': { icon: Drumstick, tone: 'accent' as const },
    Unknown: { icon: CircleHelp, tone: 'outline' as const },
  }[value];
  const Icon = map.icon;
  return (
    <Badge tone={map.tone}>
      <Icon size={14} aria-hidden="true" />
      {value === 'Unknown' ? 'Diet unknown' : value}
      {confidence === 'low' && value !== 'Unknown' && <span className="font-normal opacity-80">· unsure</span>}
    </Badge>
  );
}

export function FavouriteButton({ active, onToggle, name, size = 'md' }: { active: boolean; onToggle: () => void; name: string; size?: 'md' | 'lg' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      className={cx('grid shrink-0 place-items-center rounded-full transition-colors hover:bg-accent-soft', size === 'lg' ? 'h-12 w-12' : 'h-11 w-11')}
    >
      <Heart size={size === 'lg' ? 24 : 21} aria-hidden="true" className={active ? 'fill-accent text-accent' : 'text-ink/60'} />
    </button>
  );
}

export function PriceTag({ item, currency }: { item: MenuItem; currency: string }) {
  const p = formatPrice(item.priceINR, currency);
  if (p) return <span className="whitespace-nowrap font-heading text-lg font-semibold text-ink">{p}</span>;
  return (
    <span className="whitespace-nowrap text-[13px] text-muted" title={item.priceText ? `Printed as “${item.priceText}”` : undefined}>
      {item.priceText ? `“${item.priceText}”` : 'Price not readable'}
    </span>
  );
}

/** Card for a dish that was read from the menu but not explained yet (one dish at a time). */
export function PendingDishCard({
  item,
  currency,
  sourceLanguage,
  favourite,
  onToggleFavourite,
  onTranslate,
  status,
  canTranslate,
}: {
  item: MenuItem;
  currency: string;
  sourceLanguage: string;
  favourite: boolean;
  onToggleFavourite: () => void;
  onTranslate: () => void;
  status: DishStatus | undefined;
  canTranslate: boolean;
}) {
  const name = item.transliteration || item.originalName;
  const busy = status?.state === 'loading' || status?.state === 'waiting';
  return (
    <article className="flex w-full flex-col rounded-[14px] border border-dashed border-brand/30 bg-white/70 p-4 sm:p-5" aria-labelledby={`dish-${item.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {item.transliteration && (
            <p lang={langTagFor(sourceLanguage)} className="text-[15px] text-muted">
              {item.originalName}
            </p>
          )}
          <h3 id={`dish-${item.id}`} className="mt-0.5 font-heading text-[19px] leading-snug text-ink">
            {name}
          </h3>
          <p className="mt-1 text-[14px] text-ink/70">Not translated yet{item.transliteration ? ' · name shown as pronounced' : ''}</p>
        </div>
        <FavouriteButton active={favourite} onToggle={onToggleFavourite} name={name} />
      </div>
      {item.needsReview && (
        <p className="mt-2 flex items-start gap-1.5 text-[14px] text-accent-ink">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          Text was hard to read — check the original menu.
        </p>
      )}
      {status?.state === 'error' && (
        <p className="mt-2 flex items-start gap-1.5 text-[14px] text-danger" role="alert">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {status.message}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <PriceTag item={item} currency={currency} />
        <button
          type="button"
          onClick={onTranslate}
          disabled={busy || !canTranslate}
          aria-label={`Translate and explain ${name}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-[15px] font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status?.state === 'loading' ? (
            <>
              <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Translating…
            </>
          ) : status?.state === 'waiting' ? (
            <>
              <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> Free AI limit — retry in {status.seconds}s
            </>
          ) : (
            <>
              <Languages size={17} aria-hidden="true" /> {status?.state === 'error' ? 'Try again' : 'Translate this dish'}
            </>
          )}
        </button>
      </div>
    </article>
  );
}

export function MenuItemCard({
  item,
  currency,
  sourceLanguage,
  favourite,
  onToggleFavourite,
  onOpen,
  match,
}: {
  item: MenuItem;
  currency: string;
  sourceLanguage: string;
  favourite: boolean;
  onToggleFavourite: () => void;
  onOpen: () => void;
  match: MatchResult | null;
}) {
  const sameName = item.translatedName.trim().toLowerCase() === item.originalName.trim().toLowerCase();
  return (
    <article className={cx('card flex w-full flex-col p-4 sm:p-5', match?.level === 'match' && 'ring-2 ring-brand/40')} aria-labelledby={`dish-${item.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p lang={langTagFor(sourceLanguage)} className="text-[15px] text-muted">
            {item.originalName}
          </p>
          <h3 id={`dish-${item.id}`} className="mt-0.5 font-heading text-[19px] leading-snug text-ink">
            {sameName ? <span className="italic">{item.translatedName}</span> : item.translatedName}
          </h3>
        </div>
        <FavouriteButton active={favourite} onToggle={onToggleFavourite} name={item.translatedName} />
      </div>

      {item.description ? (
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-ink/80">{item.description}</p>
      ) : (
        <p className="mt-2 text-[15px] text-muted">No description available for this item.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <SpiceIndicator level={item.spiceLevel} confidence={item.spiceConfidence} />
        <DietaryBadge value={item.dietaryClassification} confidence={item.dietaryConfidence} />
        <Badge tone="neutral">{item.foodCategory === 'Other' ? 'Other / Unknown' : item.foodCategory}</Badge>
        {item.cuisine && <Badge tone="outline">{item.cuisine}</Badge>}
      </div>

      {(item.needsReview || match?.level === 'caution' || match?.level === 'match') && (
        <div className="mt-3 flex flex-col gap-1.5 text-[14px]">
          {item.needsReview && (
            <p className="flex items-start gap-1.5 text-accent-ink">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Text was hard to read — check the original menu.
            </p>
          )}
          {match?.level === 'match' && (
            <p className="flex items-start gap-1.5 text-brand">
              <Leaf size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Possible match for your preferences
            </p>
          )}
          {match?.level === 'caution' && (
            <p className="flex items-start gap-1.5 text-accent-ink">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {match.cautions.slice(0, 2).join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <PriceTag item={item} currency={currency} />
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 rounded-xl bg-sage px-4 text-[15px] font-medium text-brand hover:bg-brand hover:text-white"
          aria-label={`View details for ${item.translatedName}`}
        >
          View details
        </button>
      </div>
    </article>
  );
}
