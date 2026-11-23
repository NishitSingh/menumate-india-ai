import { useRef, useState, type DragEvent } from 'react';
import { ArrowRight, Camera, ImagePlus, Lock, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button, PageHeader, cx } from '../components/ui';
import { ErrorMessage } from '../components/Feedback';
import { ACCEPTED_EXT, ACCEPTED_TYPES, IMAGE_ERROR_TEXT, ImageError, MAX_FILE_MB, formatBytes, loadImage, type LoadedImage } from '../lib/image';
import { DEMO_MENU_ID } from '../data/sampleMenu';
import { navigate } from '../state/router';
import { useStore } from '../state/store';

const ACCEPT = [...ACCEPTED_TYPES, ...ACCEPTED_EXT].join(',');

export function UploadArea({ onFile, busy }: { onFile: (f: File | undefined) => void; busy: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cx(
        'flex flex-col items-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition-colors md:py-14',
        dragging ? 'border-brand bg-sage' : 'border-brand/30 bg-white',
      )}
    >
      <span className="grid h-16 w-16 place-items-center rounded-full bg-sage text-brand">
        <ImagePlus size={30} aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-heading text-xl">Add a photo of the menu</h2>
      <p className="mt-1 text-[15px] text-muted">
        <span className="hidden md:inline">Drag and drop an image here, or choose one below. </span>
        JPG, PNG or WebP, up to {MAX_FILE_MB} MB.
      </p>
      <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button size="lg" onClick={() => cameraInput.current?.click()} disabled={busy} className="md:hidden">
          <Camera size={20} aria-hidden="true" />
          Take photo
        </Button>
        <Button size="lg" variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy} className="md:bg-brand md:text-white md:ring-0 md:hover:bg-brand-dark">
          <Upload size={20} aria-hidden="true" />
          Choose from device
        </Button>
        <Button size="lg" variant="secondary" onClick={() => cameraInput.current?.click()} disabled={busy} className="hidden md:inline-flex">
          <Camera size={20} aria-hidden="true" />
          Use camera
        </Button>
      </div>
      <input ref={fileInput} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))}
      />
    </div>
  );
}

export function ImagePreview({ image, onReplace, onRemove }: { image: LoadedImage; onReplace: () => void; onRemove: () => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="grid place-items-center bg-ink/5 p-3">
        <img src={image.url} alt={`Preview of the uploaded menu photo, ${image.file.name}`} className="max-h-[52vh] w-auto rounded-lg object-contain" />
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium">{image.file.name}</p>
          <p className="text-[14px] text-muted">
            {formatBytes(image.file.size)} · {image.width}×{image.height}px
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onReplace}>
            <RefreshCw size={16} aria-hidden="true" />
            Replace
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-danger hover:bg-danger-soft">
            <Trash2 size={16} aria-hidden="true" />
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UploadScreen() {
  const { draft, setDraft, openMenu } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const replaceInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    setBusy(true);
    try {
      const img = await loadImage(file);
      setDraft(img);
    } catch (e) {
      setError(e instanceof ImageError ? e.message : IMAGE_ERROR_TEXT.unreadable);
    } finally {
      setBusy(false);
    }
  };

  const onContinue = () => {
    if (!draft) {
      setError(IMAGE_ERROR_TEXT.empty);
      return;
    }
    navigate('language');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <PageHeader title="Translate a menu" subtitle="Step 1 of 2 — add a clear photo of the menu page you want to understand." />

      <div aria-live="polite">{error && <ErrorMessage title="That photo didn’t work">{error}</ErrorMessage>}</div>

      <div className="mt-4">
        {draft ? (
          <>
            <ImagePreview image={draft} onReplace={() => replaceInput.current?.click()} onRemove={() => (setDraft(null), setError(null))} />
            <input
              ref={replaceInput}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => (void handleFile(e.target.files?.[0]), (e.target.value = ''))}
            />
          </>
        ) : (
          <UploadArea onFile={(f) => void handleFile(f)} busy={busy} />
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => openMenu(DEMO_MENU_ID)} className="min-h-11 rounded-lg px-1 text-left font-medium text-brand underline-offset-4 hover:underline">
          No menu handy? Try the sample menu
        </button>
        <Button size="lg" onClick={onContinue}>
          Continue
          <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>

      <section className="mt-10 grid gap-4 md:grid-cols-2" aria-label="Photo tips">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h2 className="font-heading text-[17px]">Tips for the best results</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-ink/80 marker:text-brand">
            <li>Photograph one page at a time, flat and straight-on.</li>
            <li>Use good light and avoid glare on laminated menus.</li>
            <li>Make sure dish names and prices are in focus.</li>
            <li>Fill the frame with the menu, not the table.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-sage p-5">
          <h2 className="flex items-center gap-2 font-heading text-[17px]">
            <Lock size={18} className="text-brand" aria-hidden="true" />
            Your photo stays private
          </h2>
          <p className="mt-2 text-[15px] text-ink/80">
            Your photo stays on this device until you tap <strong>Translate Menu</strong>. It is then resized and sent once to the AI service for reading — we
            don’t store it on a server. Only a small thumbnail is kept in this browser.
          </p>
          <p className="mt-2 text-[14px] text-ink/70">File limit: {MAX_FILE_MB} MB, so photos upload quickly on mobile data. Large photos are resized automatically before sending.</p>
        </div>
      </section>
    </div>
  );
}
