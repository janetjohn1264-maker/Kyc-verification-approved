import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiApp } from '../src/server/app.js';

let cachedApp: ReturnType<typeof createApiApp> | null = null;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!cachedApp) {
    cachedApp = createApiApp();
  }
  return cachedApp(req as never, res as never);
}
