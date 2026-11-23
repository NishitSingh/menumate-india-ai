import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CircleCheck, CircleAlert, Languages, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button, PageHeader, cx } from '../components/ui';
import { ErrorMessage, InfoNote } from '../components/Feedback';
import { AUTO_DETECT, SOURCE_LANGUAGES, TARGET_LANGUAGES } from '../lib/languages';
import type { TargetLanguageCode } from '../lib/types';
import { DEMO_MENU_ID } from '../data/sampleMenu';
import { navigate } from '../state/router';
import { useStore } from '../state/store';

export function LanguageSelector({
  source,
  onSource,
  target,
  onTarget,
}: {
  source: string;
  onSource: (v: string) => void;
  target: TargetLanguageCode;
  onTarget: (v: TargetLanguageCode) => void;
}) {
  return (
    <div className="grid gap-6">
      <fieldset className="card min-w-0 p-5">
        <legend className="sr-only">Translate into</legend>
        <h2 className="font-heading text-lg" aria-hidden="true">
          Translate into
        </h2>
        <p className="mt-1 text-[14px] text-muted">We’ll remember your choice for next time.</p>
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {TARGET_LANGUAGES.map((l) => {
            const checked = l.code === target;
            return (
              <label
                key={l.code}
                className={cx(
                  'flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl px-4 ring-1 ring-inset transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
                  checked ? 'bg-brand/8 ring-2 ring-brand' : 'bg-white ring-line hover:bg-sage',
                )}
              >
                <input type="radio" name="target" value={l.code} checked={checked} onChange={() => onTarget(l.code)} className="sr-only" />
                <span>
                  <span className="font-medium">{l.native}</span>
                  {l.native !== l.name && <span className="ml-2 text-[14px] text-muted">{l.name}</span>}
                </span>
                <span className={cx('grid h-6 w-6 place-items-center rounded-full', checked ? 'bg-brand text-white' : 'ring-1 ring-line')} aria-hidden="true">
                  {checked && <Check size={15} />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="card p-5">
        <label htmlFor="source-lang" className="font-heading text-lg">
          Menu language
        </label>
        <p id="source-help" className="mt-1 text-[14px] text-muted">
          We detect the language automatically. Choose it yourself if the menu mixes scripts or detection is unsure.
        </p>
        <select
          id="source-lang"
          aria-describedby="source-help"
          value={source}
          onChange={(e) => onSource(e.target.value)}
          className="mt-3 h-12 w-full rounded-xl border border-line bg-white px-3 text-base"
        >
          <option value={AUTO_DETECT}>Detect automatically (recommended)</option>
          {SOURCE_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} — {l.native}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function BackendStatusLine() {
  const { backend, refreshBackend } = useStore();
  const [checking, setChecking] = useState(false);
  if (!backend) {
    return (
      <p className="flex items-center gap-2 text-[14px] text-ink/70" role="status">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Checking the translation service…
      </p>
    );
  }
  if (backend.configured) {
    return (
      <p className="flex items-center gap-2 text-[14px] text-brand" role="status">
        <CircleCheck size={16} aria-hidden="true" /> Live AI translation is available{backend.model ? ` (${backend.model})` : ''}.
      </p>
    );
  }
  return (
    <div role="status">
      <ErrorMessage
        title="Live AI translation isn’t set up on this site"
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                await refreshBackend();
                setChecking(false);
              }}
            >
              <RefreshCw size={15} aria-hidden="true" className={checking ? 'animate-spin' : ''} /> Check again
            </Button>
          </>
        }
      >
        {backend.reachable ? (
          <p>
            The server is running but has no AI key. Add <code className="rounded bg-white px-1">GEMINI_API_KEY</code> and/or{' '}
            <code className="rounded bg-white px-1">GROQ_API_KEY</code> to the server environment and restart or redeploy.
          </p>
        ) : (
          <p>
            This copy of MenuMate is running without its secure server (for example, as a static preview). Photo translation needs the serverless API
            described in the README. Everything else — including the sample menu — works here.
          </p>
        )}
      </ErrorMessage>
    </div>
  );
}

export function LanguageScreen() {
  const { draft, prefs, setPrefs, sourceHint, setSourceHint, startJob, backend, openMenu } = useStore();
  const [target, setTarget] = useState<TargetLanguageCode>(prefs.targetLanguage);

  useEffect(() => {
    if (!draft) navigate('upload');
  }, [draft]);
  if (!draft) return null;

  const live = backend?.configured === true;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <button type="button" onClick={() => navigate('upload')} className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg font-medium text-brand">
        <ArrowLeft size={18} aria-hidden="true" /> Back to photo
      </button>
      <PageHeader title="Choose languages" subtitle="Step 2 of 2 — pick the language you’d like to read the menu in." />

      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-white p-3 shadow-card">
        <img src={draft.url} alt="Your menu photo" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0">
          <p className="truncate font-medium">{draft.file.name}</p>
          <p className="text-[14px] text-muted">Ready to translate</p>
        </div>
      </div>

      <LanguageSelector
        source={sourceHint ?? AUTO_DETECT}
        onSource={(v) => setSourceHint(v === AUTO_DETECT ? null : v)}
        target={target}
        onTarget={(v) => {
          setTarget(v);
          setPrefs({ targetLanguage: v });
        }}
      />

      <div className="mt-6 grid gap-4">
        <BackendStatusLine />
        <Button
          size="lg"
          disabled={!live}
          onClick={() => startJob({ kind: 'image', image: draft, sourceHint, target })}
          className="w-full sm:w-auto sm:self-end"
        >
          <Languages size={20} aria-hidden="true" />
          Translate Menu
        </Button>
        {!live && backend && (
          <InfoNote>
            Want to see how results look?{' '}
            <button type="button" className="font-medium text-brand underline underline-offset-4" onClick={() => openMenu(DEMO_MENU_ID)}>
              Open the sample menu
            </button>{' '}
            — it uses demonstration data and works without an API key.
          </InfoNote>
        )}
        {live && (
          <p className="flex items-start gap-2 text-[14px] text-ink/70">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Tapping Translate sends a resized copy of your photo through our server to an AI service (Google Gemini, or Groq as a backup). It isn’t stored after processing.
          </p>
        )}
      </div>
    </div>
  );
}
