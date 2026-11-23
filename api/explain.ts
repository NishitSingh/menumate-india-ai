// POST /api/explain — Vercel serverless function. The Gemini key stays server-side.
import { handleExplain } from '../server/handlers';
import { post } from '../server/http';

export const POST = post(handleExplain);
