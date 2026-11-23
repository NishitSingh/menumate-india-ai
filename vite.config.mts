import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Local development API: serves /api/* from server/handlers.ts so `npm run dev`
 * works without the Vercel CLI. Reads GEMINI_API_KEY / GROQ_API_KEY from .env.local.
 * Variables are NOT prefixed with VITE_, so Vite never exposes them to the browser.
 */
function devApi(mode: string): Plugin {
  return {
    name: 'menumate-dev-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const fileEnv = loadEnv(mode, process.cwd(), ['GEMINI_', 'GROQ_', 'AI_']);
      const pick = (k: string) => fileEnv[k] ?? process.env[k];
      const env = {
        GEMINI_API_KEY: pick('GEMINI_API_KEY'),
        GEMINI_MODEL: pick('GEMINI_MODEL'),
        GROQ_API_KEY: pick('GROQ_API_KEY'),
        GROQ_MODEL: pick('GROQ_MODEL'),
        AI_PROVIDER_ORDER: pick('AI_PROVIDER_ORDER'),
      };
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const route = req.url.slice(5).split('?')[0];
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        try {
          const handlers = await server.ssrLoadModule('/server/handlers.ts');
          if (route === 'health' && req.method === 'GET') return send(200, handlers.handleHealth(env).body);
          const handler = handlers.ROUTES[route];
          if (!handler || req.method !== 'POST') return send(404, { error: { code: 'NOT_FOUND', message: 'Unknown API route', retryable: false } });
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          let body: unknown;
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            return send(400, { error: { code: 'BAD_REQUEST', message: 'Body must be JSON', retryable: false } });
          }
          const r = await handler(body, env);
          send(r.status, r.body);
        } catch (e) {
          server.config.logger.error(String(e));
          send(500, { error: { code: 'INTERNAL', message: 'Dev server error', retryable: true } });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), devApi(mode)],
  build: { target: 'es2022', sourcemap: false },
}));
