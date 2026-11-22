import express, { type NextFunction, type Request, type Response } from 'express';
import dotenv from 'dotenv';

import { createSifaloPaymentService, type SifaloPaymentServiceDeps } from './sifaloPayments.js';

dotenv.config();

export function createApiApp(deps: SifaloPaymentServiceDeps = {}) {
  const app = express();
  app.set('trust proxy', 1);

  const sifaloPaymentService = createSifaloPaymentService(deps);

  const captureRawBody = (req: Request, _res: Response, buf: Buffer) => {
    (req as Request & { rawBody?: Buffer }).rawBody = buf;
  };

  app.use(express.json({ limit: '15mb', verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, limit: '15mb', verify: captureRawBody }));

  // Normalize URL prefix when Vercel rewrites /api/(.*) to /api/index.ts
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (
      !req.url.startsWith('/api/') &&
      req.url !== '/api' &&
      (req.url.startsWith('/health') ||
        req.url.startsWith('/webhooks/sifalo') ||
        req.url.startsWith('/sifalo/webhook') ||
        req.url.startsWith('/payments/sifalo'))
    ) {
      req.url = `/api${req.url}`;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    return res.status(200).json({
      ok: true,
      status: 'healthy',
      configured: sifaloPaymentService.isConfigured(),
      service: 'kycapproved-api',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        sifaloConfig: '/api/payments/sifalo/config',
        sifaloWebhook: '/api/webhooks/sifalo',
        sifaloWebhookAlias: '/api/sifalo/webhook',
        sifaloCreateCheckout: '/api/payments/sifalo/create-checkout',
        sifaloVerifyOrder: '/api/payments/sifalo/verify-order',
        sifaloAuthorizeUnlock: '/api/payments/sifalo/authorize-unlock',
      },
    });
  });

  app.post('/api/webhooks/sifalo', sifaloPaymentService.handleWebhook);
  app.post('/api/sifalo/webhook', sifaloPaymentService.handleWebhook);
  app.use('/api/payments/sifalo', sifaloPaymentService.createRouter());

  return app;
}
