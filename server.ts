import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Mount Vite in development or static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    const publicPath = path.join(__dirname, 'public');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    if (fs.existsSync(publicPath)) {
      app.use(express.static(publicPath));
    }
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = fs.existsSync(path.join(distPath, 'index.html'))
        ? path.join(distPath, 'index.html')
        : path.join(__dirname, 'index.html');
      res.sendFile(indexFile);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
