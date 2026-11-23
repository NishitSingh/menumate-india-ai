// POST /api/translate — Vercel serverless function. The Gemini key stays server-side.
import { handleTranslate } from '../server/handlers';
import { post } from '../server/http';

export const POST = post(handleTranslate);
