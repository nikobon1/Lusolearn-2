import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';

type ReqBody = {
  model?: string;
  contents?: unknown;
  config?: unknown;
};

const readInlineData = (response: any): { mimeType?: string; data: string } | null => {
  const candidates = response?.candidates;
  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return {
          mimeType: part.inlineData.mimeType,
          data: part.inlineData.data,
        };
      }
    }
  }

  return null;
};

const localGeminiProxy = (apiKey: string): Plugin => ({
  name: 'local-gemini-proxy',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/gemini', async (req, res, next) => {
      if (!req.url || req.url !== '/' && req.url !== '') return next();

      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: '[server] Missing GEMINI_API_KEY' }));
        return;
      }

      try {
        const rawBody = await new Promise<string>((resolve, reject) => {
          let data = '';
          req.on('data', chunk => { data += chunk; });
          req.on('end', () => resolve(data));
          req.on('error', reject);
        });

        const body: ReqBody = rawBody ? JSON.parse(rawBody) : {};
        if (!body?.model || !body?.contents) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid request body: model and contents are required' }));
          return;
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: body.model,
          contents: body.contents as any,
          config: body.config as any,
        });

        const inlineData = readInlineData(response);
        res.statusCode = 200;
        res.end(JSON.stringify({
          text: response.text ?? null,
          inlineData,
        }));
      } catch (error: any) {
        const status = error?.status || 500;
        const message = error?.message || 'Gemini proxy request failed';
        res.statusCode = status;
        res.end(JSON.stringify({ error: message }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Get API keys from .env.local OR Vercel environment variables
  const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  const elevenLabsKey = env.ELEVEN_LABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || '';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), localGeminiProxy(geminiKey)],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(geminiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      'process.env.ELEVEN_LABS_API_KEY': JSON.stringify(elevenLabsKey)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
