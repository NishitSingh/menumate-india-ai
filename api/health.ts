// GET /api/health — tells the browser whether live AI translation is configured.
// Reports only a boolean and the model name, never the key.
import { handleHealth } from '../server/handlers';
import { env, json } from '../server/http';

export function GET(): Response {
  return json(handleHealth(env()));
}
