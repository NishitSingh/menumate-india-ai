// The translation workflow. Each stage reports its real status; nothing is
// marked done until the underlying operation has actually finished.

import type { ExtractedItem, ExtractionResult, MenuItem, SavedMenu, TargetLanguageCode, TranslatedItem } from './types';
import { ApiError, extractMenu, translateItems } from './api';
import { untranslatedItem } from './validate';
import { makeThumbnail, prepareForUpload, type LoadedImage } from './image';
import { sourceNameFromCode } from './languages';

export type StageId = 'read' | 'detect' | 'extract' | 'translate' | 'explain' | 'organise';
export type StageStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped' | 'later';

export const STAGES: { id: StageId; label: string }[] = [
  { id: 'read', label: 'Reading menu image' },
  { id: 'detect', label: 'Detecting language' },
  { id: 'extract', label: 'Extracting dish names and prices' },
  { id: 'translate', label: 'Translating menu items' },
  { id: 'explain', label: 'Preparing dish explanations' },
  { id: 'organise', label: 'Organising the translated menu' },
];

export interface JobError {
  stage: StageId;
  code: string;
  message: string;
  retryable: boolean;
}

export interface JobState {
  stages: Record<StageId, { status: StageStatus; detail?: string }>;
  running: boolean;
  error: JobError | null;
  awaitingLanguage: { guess: string } | null;
  resultMenuId: string | null;
  targetLanguage: TargetLanguageCode;
}

export type JobInput =
  | { kind: 'image'; image: LoadedImage; sourceHint: string | null; target: TargetLanguageCode }
  /** Same menu in another language: only the dishes already explained are re-translated. */
  | { kind: 'retranslate'; menu: SavedMenu; target: TargetLanguageCode };

/** Flag on dishes the user hasn't chosen to translate yet. */
export const NOT_YET_FLAG = 'Not translated yet. Tap “Translate this dish” to explain it.';

export function isUntranslated(i: { flags: string[] }) {
  return i.flags.some((f) => f === NOT_YET_FLAG || f.includes('did not return'));
}

const BATCH = 10; // small enough for free-tier per-minute token limits
const MAX_AUTO_WAITS = 8; // per API call
const MAX_AUTO_WAIT_SECONDS = 180; // longer waits (e.g. daily limits) are reported instead

function initialStages(): JobState['stages'] {
  return Object.fromEntries(STAGES.map((s) => [s.id, { status: 'pending' as StageStatus }])) as JobState['stages'];
}

export class TranslationJob {
  state: JobState;
  private extraction: ExtractionResult | null = null;
  private sourceLanguage: string | null = null;
  private translated = new Map<string, TranslatedItem>();
  private upload: { base64: string; mimeType: string } | null = null;
  private thumbnail: string | null = null;
  private model: string | null = null;
  private controller = new AbortController();
  /** Dishes to translate now. null = none: the menu list opens and dishes are explained on tap. */
  private selectedIds: Set<string> | null = null;

  constructor(
    public input: JobInput,
    private onChange: (s: JobState) => void,
    private onComplete: (m: SavedMenu) => void,
  ) {
    this.state = {
      stages: initialStages(),
      running: false,
      error: null,
      awaitingLanguage: null,
      resultMenuId: null,
      targetLanguage: input.target,
    };
    if (input.kind === 'retranslate') {
      const m = input.menu;
      this.extraction = {
        isMenu: true,
        detectedLanguage: m.sourceLanguage,
        script: null,
        languageConfidence: m.sourceLanguageConfidence,
        currency: m.currency,
        notes: [],
        items: m.items.map((i) => ({
          id: i.id,
          order: i.order,
          originalName: i.originalName,
          originalCategory: i.originalCategory,
          priceText: i.priceText,
          price: i.priceINR,
          priceConfidence: i.priceConfidence,
          nameConfidence: i.nameConfidence,
          needsReview: i.needsReview,
          reviewNote: i.reviewNote,
        })),
      };
      this.sourceLanguage = m.sourceLanguage;
      this.thumbnail = m.thumbnail;
      this.model = m.model;
      this.selectedIds = new Set(m.items.filter((i) => !isUntranslated(i)).map((i) => i.id));
      const reuse = 'Reusing the dishes already read from this menu';
      this.set('read', 'skipped', reuse);
      this.set('detect', 'skipped', m.sourceLanguage);
      this.set('extract', 'skipped', `${m.items.length} items`);
    }
  }

  private emit() {
    this.onChange({ ...this.state, stages: { ...this.state.stages } });
  }
  private set(id: StageId, status: StageStatus, detail?: string) {
    this.state.stages[id] = { status, detail: detail ?? this.state.stages[id].detail };
  }

  /**
   * Runs an API call; if the free per-minute limit is hit and the provider says the wait
   * is short, shows a real countdown and tries again automatically (up to 3 times).
   */
  private async withRateLimitWait<T>(stage: StageId, fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
    for (let waits = 0; ; waits++) {
      try {
        return await fn();
      } catch (e) {
        const suggested = e instanceof ApiError && e.code === 'RATE_LIMITED' ? (e.retryAfterSeconds ?? 30) : null;
        if (suggested === null || suggested > MAX_AUTO_WAIT_SECONDS || waits >= MAX_AUTO_WAITS) throw e;
        // Small safety margin, and wait a little longer each time the limit is hit again.
        const wait = Math.min(MAX_AUTO_WAIT_SECONDS, Math.max(Math.ceil(suggested) + 2, 15 * waits));
        const previous = this.state.stages[stage].detail;
        for (let s = wait; s > 0; s--) {
          if (signal.aborted) throw new ApiError('ABORTED', 'Cancelled', false);
          this.set(stage, 'active', `Free AI limit reached — continuing in ${s}s`);
          this.emit();
          await new Promise((r) => setTimeout(r, 1000));
        }
        this.set(stage, 'active', previous);
        this.emit();
      }
    }
  }

  get sourceLanguageName(): string | null {
    return this.sourceLanguage;
  }

  /** Number of dishes translated so far (for "view what's done" after an error). */
  get translatedCount(): number {
    return this.translated.size;
  }
  get totalCount(): number {
    return this.extraction?.items.length ?? 0;
  }

  /** Save what has been translated so far; the rest can be finished later from the menu. */
  savePartial(): SavedMenu | null {
    if (!this.extraction || !this.sourceLanguage) return null;
    const menu = this.buildMenu();
    this.state.resultMenuId = menu.id;
    this.state.error = null;
    this.emit();
    this.onComplete(menu);
    return menu;
  }

  cancel() {
    this.controller.abort();
    this.state.running = false;
    this.emit();
  }

  /** Resume after the user picks or confirms the source language. */
  confirmLanguage(languageName: string) {
    this.sourceLanguage = languageName;
    this.state.awaitingLanguage = null;
    this.set('detect', 'done', `${languageName} (confirmed by you)`);
    void this.run();
  }

  async run(): Promise<void> {
    if (this.state.running) return;
    if (this.controller.signal.aborted) this.controller = new AbortController();
    const signal = this.controller.signal;
    this.state.running = true;
    this.state.error = null;
    this.emit();
    let stage: StageId = 'read';
    try {
      // 1. Read the image (client-side resize + compression)
      if (this.input.kind === 'image' && !this.upload) {
        stage = 'read';
        this.set('read', 'active', 'Optimising photo for upload');
        this.emit();
        const prepared = prepareForUpload(this.input.image.img);
        this.upload = { base64: prepared.base64, mimeType: prepared.mimeType };
        this.thumbnail = makeThumbnail(this.input.image.img);
        this.set('read', 'done', `${prepared.width}×${prepared.height}px, ${Math.round(prepared.bytes / 1024)} KB`);
        this.emit();
      }

      // 2–3. OCR + language detection (one AI call returns both)
      if (!this.extraction && this.upload) {
        stage = 'extract';
        this.set('detect', 'active', 'Sending to AI');
        this.set('extract', 'active');
        this.emit();
        const hint = this.input.kind === 'image' && this.input.sourceHint ? sourceNameFromCode(this.input.sourceHint) : null;
        const upload = this.upload;
        const { extraction, model } = await this.withRateLimitWait('extract', () => extractMenu(upload, hint, signal), signal);
        this.model = model;
        if (!extraction.isMenu || extraction.items.length === 0) {
          this.set('detect', extraction.detectedLanguage === 'Unknown' ? 'error' : 'done', extraction.detectedLanguage);
          throw new ApiError(
            'UNREADABLE',
            'We couldn’t find any dishes in this photo. Make sure the menu text is in focus, well lit and fills most of the frame.',
            false,
          );
        }
        this.extraction = extraction;
        const reviewCount = extraction.items.filter((i) => i.needsReview).length;
        this.set('extract', 'done', `${extraction.items.length} items found${reviewCount ? `, ${reviewCount} need review` : ''}`);
        if (hint) {
          this.sourceLanguage = hint;
          this.set('detect', 'done', `${hint} (selected by you)`);
        } else if (extraction.detectedLanguage === 'Unknown' || extraction.languageConfidence === 'low') {
          this.set('detect', 'error', 'Not sure which language this is');
          this.state.awaitingLanguage = { guess: extraction.detectedLanguage };
          this.state.running = false;
          this.emit();
          return; // paused until confirmLanguage()
        } else {
          this.sourceLanguage = extraction.detectedLanguage;
          this.set('detect', 'done', `${extraction.detectedLanguage} (${extraction.languageConfidence} confidence)`);
        }
        this.emit();
      }

      if (!this.extraction || !this.sourceLanguage) throw new ApiError('INTERNAL', 'Missing extraction data.', false);

      // New photo: go straight to the dish list. Each dish is explained only when the user
      // taps "Translate this dish" (1 small request each), which keeps free AI quotas lasting.
      if (!this.selectedIds) {
        const onDemand = 'On demand — tap any dish to translate it';
        this.set('translate', 'later', onDemand);
        this.set('explain', 'later', onDemand);
        this.set('organise', 'done', `${this.extraction.items.length} dishes listed`);
        const menu = this.buildMenu();
        this.state.resultMenuId = menu.id;
        this.state.running = false;
        this.emit();
        this.onComplete(menu);
        return;
      }

      // 4–5. Translation + dish intelligence for the chosen dish(es) only
      stage = 'translate';
      const chosen = this.selectedIds;
      const pending = this.extraction.items.filter((i) => chosen.has(i.id) && !this.translated.has(i.id));
      const label = (i: ExtractedItem) => i.transliteration || i.originalName;
      this.set('explain', 'active', 'Generated together with the translation');
      for (let i = 0; i < pending.length; i += BATCH) {
        const batch: ExtractedItem[] = pending.slice(i, i + BATCH);
        this.set('translate', 'active', pending.length === 1 ? label(batch[0]) : `Dishes ${i + 1}–${i + batch.length} of ${pending.length}`);
        this.emit();
        const source = this.sourceLanguage;
        const out = await this.withRateLimitWait('translate', () => translateItems(batch, source, this.input.target, signal), signal);
        out.forEach((t) => this.translated.set(t.id, t));
      }
      this.set('translate', 'done', pending.length === 1 ? label(pending[0]) : `${pending.length} dishes`);
      this.set('explain', 'done');

      // 6. Organise + validate + save
      stage = 'organise';
      this.set('organise', 'active');
      this.emit();
      const menu = this.buildMenu();
      this.set('organise', 'done', menu.status === 'partial' ? 'Some items could not be translated' : undefined);
      this.state.resultMenuId = menu.id;
      this.state.running = false;
      this.emit();
      this.onComplete(menu);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError('INTERNAL', 'Something unexpected went wrong.', true);
      if (err.code === 'ABORTED') return;
      // Translation errors are reported against the stage that failed.
      if (stage === 'translate') this.set('explain', 'pending');
      if (stage === 'extract') this.set('detect', this.state.stages.detect.status === 'done' ? 'done' : 'error');
      this.set(stage, 'error');
      this.state.error = { stage, code: err.code, message: err.message, retryable: err.retryable };
      this.state.running = false;
      this.emit();
    }
  }

  private buildMenu(): SavedMenu {
    const ex = this.extraction!;
    const previous = this.input.kind === 'retranslate' ? new Map(this.input.menu.items.map((i) => [i.id, i])) : null;
    const items: MenuItem[] = ex.items.map((o) => {
      const t = this.translated.get(o.id) ?? untranslatedItem(o, NOT_YET_FLAG);
      return {
        id: o.id,
        order: o.order,
        originalName: o.originalName,
        originalCategory: o.originalCategory,
        nameConfidence: o.nameConfidence,
        needsReview: o.needsReview,
        reviewNote: o.reviewNote,
        // The price always comes from extraction — translation output cannot change it.
        priceINR: o.price,
        priceText: o.priceText,
        priceConfidence: o.priceConfidence,
        translatedName: t.translatedName,
        transliteration: t.transliteration ?? o.transliteration ?? null,
        description: t.description,
        foodCategory: t.foodCategory,
        cuisine: t.cuisine,
        spiceLevel: t.spiceLevel,
        spiceConfidence: t.spiceConfidence,
        ingredients: t.ingredients,
        preparationMethod: t.preparationMethod,
        dietaryClassification: t.dietaryClassification,
        dietaryConfidence: t.dietaryConfidence,
        dietaryNote: t.dietaryNote,
        allergenWarnings: t.allergenWarnings,
        culinaryTerms: t.culinaryTerms,
        confidence: t.confidence,
        // An explanation is language-specific, so it is only kept when the language is unchanged.
        explanation: previous && this.input.kind === 'retranslate' && this.input.menu.targetLanguage === this.input.target ? (previous.get(o.id)?.explanation ?? null) : null,
        flags: t.flags,
      };
    });
    const now = new Date();
    const partial = items.some(isUntranslated);
    const name = this.input.kind === 'image' ? this.input.image.file.name : this.input.menu.imageName;
    return {
      id: `m${now.getTime().toString(36)}`,
      title: `${this.sourceLanguage} menu`,
      imageName: name,
      thumbnail: this.thumbnail,
      sourceLanguage: this.sourceLanguage!,
      sourceLanguageConfidence: ex.languageConfidence,
      targetLanguage: this.input.target,
      status: partial ? 'partial' : 'complete',
      createdAt: now.toISOString(),
      isDemo: false,
      currency: ex.currency,
      items,
      notes: ex.notes,
      model: this.model,
    };
  }
}
