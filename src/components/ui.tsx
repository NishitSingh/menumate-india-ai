import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Confidence } from '../lib/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  accent: 'bg-accent text-ink hover:brightness-95 shadow-sm',
  secondary: 'bg-white text-brand ring-1 ring-inset ring-brand/30 hover:bg-sage',
  ghost: 'text-brand hover:bg-sage',
  danger: 'bg-danger text-white hover:brightness-95',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' && 'min-h-10 px-3 text-sm',
        size === 'md' && 'min-h-11 px-4 text-[15px]',
        size === 'lg' && 'min-h-13 px-6 text-base',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'accent' | 'danger' | 'outline'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-medium',
        tone === 'neutral' && 'bg-sage text-ink',
        tone === 'brand' && 'bg-brand/10 text-brand',
        tone === 'accent' && 'bg-accent-soft text-accent-ink',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'outline' && 'ring-1 ring-inset ring-line text-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}

const CONF_TEXT: Record<Confidence, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
export function ConfidenceTag({ value, label }: { value: Confidence; label?: string }) {
  const dots = value === 'high' ? 3 : value === 'medium' ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted" title={label ? `${label}: ${CONF_TEXT[value]}` : CONF_TEXT[value]}>
      <span aria-hidden="true" className="inline-flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1.5 w-1.5 rounded-full', i <= dots ? 'bg-brand' : 'bg-line')} />
        ))}
      </span>
      {CONF_TEXT[value]}
    </span>
  );
}

/** Small label marking AI-generated content, so it is never mistaken for menu text. */
export function EstimateLabel({ demo }: { demo?: boolean }) {
  return (
    <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wide text-accent-ink">
      {demo ? 'Demo estimate' : 'AI estimate'}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-heading text-[28px] text-ink md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-ink/75">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function formatPrice(price: number | null, currency = 'INR') {
  if (price === null) return null;
  const n = price % 1 === 0 ? price.toLocaleString('en-IN') : price.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  return currency === 'INR' ? `₹${n}` : `${currency} ${n}`;
}

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}
