import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json());

// API routes can be added here
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GearGen Pro Server Running' });
});

async function startServer() {
  if (isDev) {
    // Development: Use Vite dev server
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    
    app.use(vite.middlewares);
    
    console.log(`[DEV] GearGen Pro running on http://localhost:${PORT}`);
  } else {
    // Production: Serve built files
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    
    console.log(`[PROD] GearGen Pro running on http://localhost:${PORT}`);
  }
  
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
