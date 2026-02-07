import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
    plugins: [react()],
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
