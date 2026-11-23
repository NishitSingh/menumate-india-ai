// POST /api/recommend — Vercel serverless function. The Gemini key stays server-side.
import { handleRecommend } from '../server/handlers';
import { post } from '../server/http';

export const POST = post(handleRecommend);
