import express, { type NextFunction, type Request, type Response } from 'express';
import dotenv from 'dotenv';

import { createSifaloPaymentService, type SifaloPaymentServiceDeps } from './sifaloPayments.js';
import { KycAdminService } from './adminService.js';
import { KycCustomerService } from './customerService.js';

if (!process.env.VERCEL) {
  dotenv.config();
}

export interface ApiAppDeps extends SifaloPaymentServiceDeps {
  adminPersistencePath?: string;
  customerPersistencePath?: string;
}

export function createApiApp(deps: ApiAppDeps = {}) {
  const app = express();
  app.set('trust proxy', 1);
  app.set('etag', false);

  const kycCustomerService = new KycCustomerService(deps.customerPersistencePath, deps.now);
  const sifaloPaymentService = createSifaloPaymentService({
    ...deps,
    resolveAuthenticatedCustomerId: (req) => kycCustomerService.resolveAuthenticatedCustomerId(req),
    onVerifiedCustomerAccessOrder: (order, fallbackCustomerId, req, res) =>
      kycCustomerService.grantVerifiedSifaloOrderToCustomer(order, fallbackCustomerId, req, res),
    onRevokedCustomerAccessOrder: (orderId, reason) =>
      kycCustomerService.revokeSifaloOrderEntitlement(orderId, reason),
    evaluateCustomerPaidAccess: (req) => kycCustomerService.evaluateCustomerPaidAccess(req),
  });
  const kycAdminService = new KycAdminService(
    sifaloPaymentService,
    deps.adminPersistencePath,
    kycCustomerService
  );
  app.locals.sifaloPaymentService = sifaloPaymentService;
  app.locals.kycAdminService = kycAdminService;
  app.locals.kycCustomerService = kycCustomerService;

  const captureRawBody = (req: Request, _res: Response, buf: Buffer) => {
    (req as Request & { rawBody?: Buffer }).rawBody = buf;
  };

  app.use(express.json({ limit: '15mb', verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, limit: '15mb', verify: captureRawBody }));

  // Prevent browser or CDN edge caching of dynamic payment/health status
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Normalize URL prefix when Vercel rewrites /api/(.*) to /api/index.ts
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (
      !req.url.startsWith('/api/') &&
      req.url !== '/api' &&
      (req.url.startsWith('/health') ||
        req.url.startsWith('/catalog') ||
        req.url.startsWith('/preview-protection') ||
        req.url.startsWith('/admin') ||
        req.url.startsWith('/customer') ||
        req.url.startsWith('/webhooks/sifalo') ||
        req.url.startsWith('/sifalo/webhook') ||
        req.url.startsWith('/payments/sifalo'))
    ) {
      req.url = `/api${req.url}`;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    const diagnostics = sifaloPaymentService.getDiagnostics();
    const configured = diagnostics.SIFALO_API_USER_PRESENT && diagnostics.SIFALO_API_KEY_PRESENT;
    return res.status(200).json({
      ok: true,
      status: 'healthy',
      configured,
      diagnostics: {
        SIFALO_API_USER_PRESENT: diagnostics.SIFALO_API_USER_PRESENT,
        SIFALO_API_KEY_PRESENT: diagnostics.SIFALO_API_KEY_PRESENT,
        SIFALO_WEBHOOK_SECRET_PRESENT: diagnostics.SIFALO_WEBHOOK_SECRET_PRESENT,
        SIFALO_ENV: diagnostics.SIFALO_ENV,
        APP_BASE_URL_PRESENT: diagnostics.APP_BASE_URL_PRESENT,
        VERCEL_ENV: diagnostics.VERCEL_ENV,
        checkoutHostname: diagnostics.checkoutHostname,
        gatewayHostname: diagnostics.gatewayHostname,
      },
      service: 'kycapproved-api',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/health',
        catalog: '/api/catalog',
        previewProtectionConfig: '/api/preview-protection/config',
        previewProtectionVerify: '/api/preview-protection/verify-access',
        adminAuthStatus: '/api/admin/auth/status',
        customerAuthStatus: '/api/customer/auth/status',
        sifaloConfig: '/api/payments/sifalo/config',
        sifaloDiagnostics: '/api/payments/sifalo/diagnostics',
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
  app.use('/api/catalog', kycAdminService.createPublicCatalogRouter());
  app.use('/api/preview-protection', kycAdminService.createPreviewProtectionRouter());
  app.use('/api/admin', kycAdminService.createAdminRouter());
  app.use('/api/customer', kycCustomerService.createCustomerRouter());

  return app;
}

