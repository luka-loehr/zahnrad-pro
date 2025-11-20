import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const runtimeApiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const fileApiKey = env.API_KEY || env.GEMINI_API_KEY;
  const resolvedApiKey = fileApiKey || runtimeApiKey || '';

  if (!resolvedApiKey) {
    console.warn('[GearGen Pro] No Gemini API key found in .env files or process env.');
  } else if (!fileApiKey && runtimeApiKey) {
    console.info('[GearGen Pro] Using Gemini API key from process.env (not .env files).');
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(resolvedApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(resolvedApiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
