import type { ReactNode } from 'react';
import { CircleAlert, Info, ShieldAlert } from 'lucide-react';
import { cx } from './ui';

export const SAFETY_TEXT =
  'Ingredient and allergen information is estimated from menu text and AI analysis. Recipes vary by restaurant. Always confirm ingredients and food restrictions directly with restaurant staff.';

export function SafetyNotice({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cx('flex gap-3 rounded-xl bg-accent-soft p-4 text-[14px] leading-relaxed text-ink', className)} role="note">
      <ShieldAlert size={20} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden="true" />
      <p>
        {!compact && <strong className="font-semibold">Please check with staff. </strong>}
        {SAFETY_TEXT}
      </p>
    </div>
  );
}

export function ErrorMessage({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-danger/25 bg-danger-soft p-4 text-ink">
      <div className="flex gap-3">
        <CircleAlert size={20} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-semibold text-danger">{title}</p>
          {children && <div className="mt-1 text-[15px] text-ink/85">{children}</div>}
          {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

export function InfoNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex gap-3 rounded-xl bg-sage p-4 text-[14px] leading-relaxed text-ink', className)}>
      <Info size={19} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-sage text-brand">{icon}</div>
      <h2 className="mt-4 font-heading text-xl">{title}</h2>
      {children && <p className="mt-2 max-w-md text-[15px] text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
