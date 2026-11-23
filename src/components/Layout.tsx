import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Globe, House, ScanLine, Settings2, X } from 'lucide-react';
import { TARGET_LANGUAGES } from '../lib/languages';
import { navigate, type Route } from '../state/router';
import { useStore } from '../state/store';
import { cx } from './ui';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <a href="#" onClick={(e) => (e.preventDefault(), navigate('home'))} className="flex items-center gap-2.5 rounded-lg" aria-label="MenuMate India AI, home">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <rect width="36" height="36" rx="10" fill="#176B5B" />
        <path d="M9 21.5a9 9 0 0 0 18 0Z" fill="#F8F5EF" />
        <path d="M7.5 21.5h21" stroke="#F8F5EF" strokeWidth="2" strokeLinecap="round" />
        <path d="M15 16.5c0-2 1.6-2.2 1.6-4.2M20 16.5c0-2 1.6-2.2 1.6-4.2" stroke="#F28C45" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <span className="font-heading text-[17px] font-semibold leading-none text-ink">
        MenuMate
        {!compact && <span className="ml-1 text-brand">India AI</span>}
        {compact && <span className="sr-only"> India AI</span>}
      </span>
    </a>
  );
}

function LanguageMenu() {
  const { prefs, setPrefs, notify } = useStore();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const current = TARGET_LANGUAGES.find((l) => l.code === prefs.targetLanguage)!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    wrap.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-ink ring-1 ring-line hover:bg-sage"
      >
        <Globe size={18} aria-hidden="true" className="text-brand" />
        <span className="sr-only">Translate into: </span>
        <span>{current.native}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Translation language" className="mm-rise absolute right-0 top-full z-40 mt-2 w-56 rounded-xl bg-white p-1.5 shadow-lift ring-1 ring-line">
          <p className="px-3 pb-1 pt-2 text-[13px] text-muted">Translate menus into</p>
          {TARGET_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="menuitemradio"
              aria-checked={l.code === prefs.targetLanguage}
              onClick={() => {
                setPrefs({ targetLanguage: l.code });
                setOpen(false);
                notify(`Menus will be translated into ${l.name}`, 'info');
              }}
              className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-[15px] hover:bg-sage"
            >
              <span>
                {l.native}
                {l.native !== l.name && <span className="ml-2 text-sm text-muted">{l.name}</span>}
              </span>
              {l.code === prefs.targetLanguage && <Check size={18} className="text-brand" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV: { route: Route; label: string }[] = [
  { route: 'upload', label: 'Translate Menu' },
  { route: 'saved', label: 'My Menus' },
  { route: 'preferences', label: 'Preferences' },
];

const TRANSLATE_ROUTES: Route[] = ['upload', 'language', 'processing', 'menu'];

export function Header({ route }: { route: Route }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-cream/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 md:h-[72px] md:px-8">
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <div className="hidden lg:block">
          <Logo />
        </div>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = n.route === route || (n.route === 'upload' && TRANSLATE_ROUTES.includes(route));
            return (
              <a
                key={n.route}
                href={`#${n.route}`}
                aria-current={active ? 'page' : undefined}
                className={cx('whitespace-nowrap rounded-lg px-3 py-2 text-[15px] font-medium', active ? 'bg-sage text-brand' : 'text-ink hover:bg-sage/70')}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
        <LanguageMenu />
      </div>
    </header>
  );
}

export function BottomNavigation({ route }: { route: Route }) {
  const items: { route: Route; label: string; icon: typeof House; match: Route[] }[] = [
    { route: 'home', label: 'Home', icon: House, match: ['home'] },
    { route: 'upload', label: 'Translate', icon: ScanLine, match: TRANSLATE_ROUTES },
    { route: 'saved', label: 'My Menus', icon: BookOpen, match: ['saved'] },
    { route: 'preferences', label: 'Preferences', icon: Settings2, match: ['preferences'] },
  ];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ route: r, label, icon: Icon, match }) => {
          const active = match.includes(route);
          return (
            <li key={r}>
              <a
                href={r === 'home' ? '#' : `#${r}`}
                onClick={r === 'home' ? (e) => (e.preventDefault(), navigate('home')) : undefined}
                aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium', active ? 'text-brand' : 'text-ink/70')}
              >
                <span className={cx('grid h-8 w-12 place-items-center rounded-full', active && 'bg-sage')}>
                  <Icon size={21} aria-hidden="true" strokeWidth={active ? 2.3 : 1.9} />
                </span>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Footer() {
  const links: { route: Route; label: string }[] = [
    { route: 'about', label: 'About' },
    { route: 'how-it-works', label: 'How it works' },
    { route: 'privacy', label: 'Privacy' },
    { route: 'contact', label: 'Contact' },
    { route: 'disclaimer', label: 'Disclaimer' },
  ];
  return (
    <footer className="on-brand bg-ink text-cream">
      <div className="mx-auto max-w-[1240px] px-4 pb-28 pt-12 md:px-8 md:pb-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-heading text-lg font-semibold">MenuMate India AI</p>
            <p className="mt-2 text-[15px] text-cream/75">Discover Indian food. Understand every dish.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {links.map((l) => (
                <li key={l.route}>
                  <a href={`#${l.route}`} className="inline-block py-1.5 text-[15px] text-cream/90 underline-offset-4 hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-10 border-t border-cream/15 pt-6 text-[13px] leading-relaxed text-cream/70">
          Ingredient and allergen information is estimated from menu text and AI analysis. Recipes vary by restaurant. Always confirm ingredients and food
          restrictions directly with restaurant staff.
        </p>
      </div>
    </footer>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cx(
            'mm-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-[15px] shadow-lift',
            t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-cream',
          )}
        >
          <span>{t.message}</span>
          <button type="button" onClick={() => dismissToast(t.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-white/10" aria-label="Dismiss">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
