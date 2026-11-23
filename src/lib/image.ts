// Client-side image validation and compression. Images stay in memory until the
// user starts a translation; only a small thumbnail is ever persisted.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
export const MAX_FILE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const MIN_DIMENSION = 300;
const UPLOAD_MAX_EDGE = 1600;
const UPLOAD_MAX_BYTES = 3 * 1024 * 1024; // keeps the request under serverless body limits

export type ImageErrorCode = 'empty' | 'type' | 'size' | 'unreadable' | 'too-small';

export class ImageError extends Error {
  constructor(public code: ImageErrorCode, message: string) {
    super(message);
  }
}

export const IMAGE_ERROR_TEXT: Record<ImageErrorCode, string> = {
  empty: 'Please add a photo of the menu first.',
  type: 'That file type isn’t supported. Please use a JPG, PNG or WebP image.',
  size: `That image is larger than ${MAX_FILE_MB} MB. Try a smaller photo or take a new one with your camera.`,
  unreadable: 'We couldn’t open that image. It may be damaged or in a format your browser can’t read (e.g. HEIC). Try a JPG or PNG.',
  'too-small': `That image is too small to read (under ${MIN_DIMENSION}px). Try a closer, higher-resolution photo.`,
};

export function checkFile(file: File | null | undefined): void {
  if (!file) throw new ImageError('empty', IMAGE_ERROR_TEXT.empty);
  const name = file.name.toLowerCase();
  const typeOk = ACCEPTED_TYPES.includes(file.type) || (!file.type && ACCEPTED_EXT.some((e) => name.endsWith(e)));
  if (!typeOk) throw new ImageError('type', IMAGE_ERROR_TEXT.type);
  if (file.size === 0) throw new ImageError('unreadable', IMAGE_ERROR_TEXT.unreadable);
  if (file.size > MAX_FILE_BYTES) throw new ImageError('size', IMAGE_ERROR_TEXT.size);
}

export interface LoadedImage {
  file: File;
  url: string; // object URL for preview
  width: number;
  height: number;
  img: HTMLImageElement;
}

export function loadImage(file: File): Promise<LoadedImage> {
  checkFile(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (Math.max(img.naturalWidth, img.naturalHeight) < MIN_DIMENSION) {
        URL.revokeObjectURL(url);
        reject(new ImageError('too-small', IMAGE_ERROR_TEXT['too-small']));
        return;
      }
      resolve({ file, url, width: img.naturalWidth, height: img.naturalHeight, img });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageError('unreadable', IMAGE_ERROR_TEXT.unreadable));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('unreadable', IMAGE_ERROR_TEXT.unreadable);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** Resize to ≤1600px and re-encode as JPEG so uploads are fast on mobile networks. */
export function prepareForUpload(img: HTMLImageElement): { base64: string; mimeType: string; bytes: number; width: number; height: number } {
  const canvas = draw(img, UPLOAD_MAX_EDGE);
  let quality = 0.85;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length * 0.75 > UPLOAD_MAX_BYTES && quality > 0.5) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return { base64, mimeType: 'image/jpeg', bytes: Math.round(base64.length * 0.75), width: canvas.width, height: canvas.height };
}

export function makeThumbnail(img: HTMLImageElement): string | null {
  try {
    return draw(img, 240).toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
