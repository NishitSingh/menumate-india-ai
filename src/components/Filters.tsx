import { Search, X } from 'lucide-react';
import { cx } from './ui';

export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <label htmlFor="menu-search" className="sr-only">
        Search dishes by original or translated name
      </label>
      <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id="menu-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search dishes"
        className="h-12 w-full rounded-xl border border-line bg-white pl-11 pr-11 text-base text-ink placeholder:text-muted focus:border-brand"
        autoComplete="off"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full hover:bg-sage" aria-label="Clear search">
          <X size={17} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[13px] font-semibold text-ink/70">{label}</legend>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:flex-wrap md:overflow-visible">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cx(
                'flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[14px] font-medium ring-1 ring-inset transition-colors',
                active ? 'bg-brand text-white ring-brand' : 'bg-white text-ink ring-line hover:bg-sage',
              )}
            >
              {o.label}
              {o.count !== undefined && <span className={cx('text-[12px]', active ? 'text-white/80' : 'text-muted')}>{o.count}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export const CategoryFilter = ChipGroup;
export const DietaryFilter = ChipGroup;
