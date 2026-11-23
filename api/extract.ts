// POST /api/extract — Vercel serverless function. The Gemini key stays server-side.
import { handleExtract } from '../server/handlers';
import { post } from '../server/http';

export const POST = post(handleExtract);
