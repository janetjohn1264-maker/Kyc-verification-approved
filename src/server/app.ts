import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';

import { createSifaloPaymentService, type SifaloPaymentServiceDeps } from './sifaloPayments.ts';

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

  app.get('/api/health', (_req: Request, res: Response) => {
    return res.status(200).json({
      ok: true,
      status: 'healthy',
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
