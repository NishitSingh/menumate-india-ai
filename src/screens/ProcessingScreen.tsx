import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Circle, LoaderCircle, RefreshCw, ScanLine } from 'lucide-react';
import { Button, PageHeader, cx } from '../components/ui';
import { EmptyState, ErrorMessage } from '../components/Feedback';
import { STAGES, type JobState, type StageStatus } from '../lib/pipeline';
import { SOURCE_LANGUAGES, targetName } from '../lib/languages';
import { DEMO_MENU_ID } from '../data/sampleMenu';
import { navigate } from '../state/router';
import { useStore } from '../state/store';

function StageIcon({ status }: { status: StageStatus }) {
  const base = 'grid h-9 w-9 shrink-0 place-items-center rounded-full';
  if (status === 'done' || status === 'skipped')
    return (
      <span className={cx(base, status === 'done' ? 'bg-brand text-white' : 'bg-sage text-brand')}>
        <Check size={18} aria-hidden="true" />
      </span>
    );
  if (status === 'active')
    return (
      <span className={cx(base, 'bg-accent-soft text-accent-ink')}>
        <LoaderCircle size={19} className="animate-spin" aria-hidden="true" />
      </span>
    );
  if (status === 'error')
    return (
      <span className={cx(base, 'bg-danger-soft text-danger')}>
        <CircleAlert size={19} aria-hidden="true" />
      </span>
    );
  return (
    <span className={cx(base, 'text-line')}>
      <Circle size={20} aria-hidden="true" />
    </span>
  );
}

const STATUS_TEXT: Record<StageStatus, string> = {
  pending: 'Waiting',
  active: 'In progress',
  done: 'Done',
  skipped: 'Reused',
  later: 'On tap',
  error: 'Needs attention',
};

export function ProcessingStatus({ state }: { state: JobState }) {
  return (
    <ol className="card divide-y divide-line/70" aria-label="Translation progress">
      {STAGES.map((s) => {
        const st = state.stages[s.id];
        return (
          <li key={s.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5" aria-current={st.status === 'active' ? 'step' : undefined}>
            <StageIcon status={st.status} />
            <div className="min-w-0 flex-1">
              <p className={cx('font-medium', st.status === 'pending' || st.status === 'later' ? 'text-ink/55' : 'text-ink')}>{s.label}</p>
              {st.detail && st.status !== 'pending' && <p className="truncate text-[14px] text-muted">{st.detail}</p>}
            </div>
            <span className={cx('text-[13px] font-medium', st.status === 'active' ? 'mm-pulse text-accent-ink' : st.status === 'error' ? 'text-danger' : 'text-muted')}>
              {STATUS_TEXT[st.status]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function useElapsed(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      start.current = null;
      return;
    }
    start.current = Date.now();
    setSeconds(0);
    const t = window.setInterval(() => setSeconds(Math.round((Date.now() - (start.current ?? Date.now())) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  return seconds;
}

const autoOpened = new Set<string>();

export function ProcessingScreen() {
  const { job, jobState, openMenu } = useStore();
  const elapsed = useElapsed(!!jobState?.running);
  const [lang, setLang] = useState('');

  useEffect(() => {
    const id = jobState?.resultMenuId;
    if (id && !jobState.running && !autoOpened.has(id)) {
      autoOpened.add(id);
      openMenu(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobState?.resultMenuId, jobState?.running]);

  useEffect(() => {
    if (jobState?.awaitingLanguage) {
      const g = jobState.awaitingLanguage.guess;
      setLang(SOURCE_LANGUAGES.some((l) => l.name === g) ? g : '');
    }
  }, [jobState?.awaitingLanguage]);

  if (!job || !jobState) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        <EmptyState
          icon={<ScanLine size={28} aria-hidden="true" />}
          title="No translation in progress"
          action={<Button onClick={() => navigate('upload')}>Translate a menu</Button>}
        >
          Start by adding a photo of a menu.
        </EmptyState>
      </div>
    );
  }

  const err = jobState.error;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <PageHeader
        title={err ? 'We hit a problem' : jobState.awaitingLanguage ? 'Which language is this?' : 'Reading your menu'}
        subtitle={`Into ${targetName(jobState.targetLanguage)}. Reading a menu usually takes 10–30 seconds.`}
      />

      <div aria-live="polite" className="sr-only">
        {STAGES.filter((s) => jobState.stages[s.id].status === 'active')
          .map((s) => s.label)
          .join(', ')}
      </div>

      <ProcessingStatus state={jobState} />

      {jobState.resultMenuId && !jobState.running && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sage p-4" role="status">
          <p className="font-medium text-brand">Your translated menu is ready.</p>
          <Button onClick={() => openMenu(jobState.resultMenuId!)}>View menu</Button>
        </div>
      )}

      {jobState.running && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-[14px] text-ink/70">Elapsed: {elapsed}s</p>
          <Button variant="ghost" onClick={() => (job.cancel(), navigate('language'))}>
            Cancel
          </Button>
        </div>
      )}

      {jobState.awaitingLanguage && (
        <div className="card mt-6 p-5">
          <p className="text-[15px] text-ink/85">
            The AI wasn’t confident about the menu’s language
            {jobState.awaitingLanguage.guess !== 'Unknown' && (
              <>
                {' '}
                (best guess: <strong>{jobState.awaitingLanguage.guess}</strong>)
              </>
            )}
            . Choosing the right one improves translation.
          </p>
          <label htmlFor="confirm-lang" className="mt-4 block text-[14px] font-semibold">
            Menu language
          </label>
          <select id="confirm-lang" value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 text-base">
            <option value="">Select a language…</option>
            {SOURCE_LANGUAGES.map((l) => (
              <option key={l.code} value={l.name}>
                {l.name} — {l.native}
              </option>
            ))}
          </select>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!lang} onClick={() => job.confirmLanguage(lang)}>
              Continue with {lang || 'this language'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('upload')}>
              Use a different photo
            </Button>
          </div>
        </div>
      )}

      {err && (
        <div className="mt-6">
          <ErrorMessage
            title={err.code === 'UNREADABLE' ? 'We couldn’t read this menu' : 'Translation didn’t finish'}
            actions={
              <>
                {!['NOT_CONFIGURED', 'DAILY_QUOTA', 'MODEL_NOT_FREE'].includes(err.code) && (
                  <Button size="sm" onClick={() => void job.run()}>
                    <RefreshCw size={15} aria-hidden="true" /> Try again
                  </Button>
                )}
                {job.totalCount > 0 ? (
                  <Button size="sm" variant="secondary" onClick={() => job.savePartial()}>
                    Show the dish list
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => navigate('upload')}>
                    Use a different photo
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openMenu(DEMO_MENU_ID)}>
                  Open sample menu
                </Button>
              </>
            }
          >
            <p>{err.message}</p>
            {err.retryable && err.code !== 'UNREADABLE' && <p className="mt-1 text-[14px] text-ink/70">Steps that already finished won’t be repeated.</p>}
            {job.totalCount > 0 && (
              <p className="mt-1 text-[14px] text-ink/70">
                The {job.totalCount} dishes read from your photo are kept — you can open the list and try a dish again later.
              </p>
            )}
          </ErrorMessage>
        </div>
      )}
    </div>
  );
}
