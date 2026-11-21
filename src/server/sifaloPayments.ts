import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';

export type UnlockProductKey =
  | 'passport'
  | 'nationalIdentity'
  | 'driverLicense'
  | 'proofOfAddress'
  | 'proofOfAccount';

export type SifaloEnvironment = 'staging' | 'production';
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export interface ProductPriceSpec {
  productKey: UnlockProductKey;
  label: string;
  amountCents: number;
  amountUsdString: string;
  formattedPrice: string;
  currency: 'USD';
}

// Authoritative server-side pricing table. Never trust prices sent by the browser.
export const AUTHORITATIVE_PRODUCT_PRICING: Record<UnlockProductKey, ProductPriceSpec> = {
  passport: {
    productKey: 'passport',
    label: 'Passport',
    amountCents: 99,
    amountUsdString: '0.99',
    formattedPrice: '$0.99',
    currency: 'USD',
  },
  nationalIdentity: {
    productKey: 'nationalIdentity',
    label: 'National Identity Card',
    amountCents: 49,
    amountUsdString: '0.49',
    formattedPrice: '$0.49',
    currency: 'USD',
  },
  driverLicense: {
    productKey: 'driverLicense',
    label: 'Driver License',
    amountCents: 49,
    amountUsdString: '0.49',
    formattedPrice: '$0.49',
    currency: 'USD',
  },
  proofOfAddress: {
    productKey: 'proofOfAddress',
    label: 'Proof of Address',
    amountCents: 49,
    amountUsdString: '0.49',
    formattedPrice: '$0.49',
    currency: 'USD',
  },
  proofOfAccount: {
    productKey: 'proofOfAccount',
    label: 'Proof of Account',
    amountCents: 49,
    amountUsdString: '0.49',
    formattedPrice: '$0.49',
    currency: 'USD',
  },
};

export function normalizeDocTypeToProductKey(rawDocType: unknown): UnlockProductKey | null {
  if (typeof rawDocType !== 'string') return null;
  const normalized = rawDocType.trim().toLowerCase().replace(/[\s_-]+/g, '');
  switch (normalized) {
    case 'passport':
      return 'passport';
    case 'idcard':
    case 'nationalid':
    case 'nationalidentity':
    case 'nationalidentitycard':
      return 'nationalIdentity';
    case 'driverlicense':
    case 'driverslicense':
      return 'driverLicense';
    case 'refugeecard':
    case 'proofofaddress':
      return 'proofOfAddress';
    case 'proofofaccount':
      return 'proofOfAccount';
    default:
      return null;
  }
}

export interface SifaloOrderRecord {
  orderId: string;
  productKey: UnlockProductKey;
  countryKey: string;
  providerKey: string;
  amountCents: number;
  amountUsdString: string;
  currency: 'USD';
  environment: SifaloEnvironment;
  status: OrderStatus;
  providerSid: string | null;
  providerToken: string | null;
  transactionRef: string | null;
  webhookAuthToken: string;
  createdAt: number;
  paidAt: number | null;
  unlockTokenId: string | null;
  unlockTokenExpiresAt: number | null;
}

export interface SifaloEndpointConfig {
  environment: SifaloEnvironment;
  gatewayUrl: string;
  verifyUrl: string;
  hostedCheckoutBaseUrl: string;
}

export interface SifaloPaymentServiceDeps {
  fetchImpl?: typeof fetch;
  getEnvironment?: () => SifaloEnvironment;
  getApiUser?: () => string;
  getApiKey?: () => string;
  getWebhookSecret?: () => string;
  getAppBaseUrl?: () => string;
  getCustomGatewayUrl?: () => string;
  getCustomVerifyUrl?: () => string;
  getCustomCheckoutBaseUrl?: () => string;
  tokenSigningSecret?: Buffer;
  now?: () => number;
}

const UNLOCK_GRANT_TTL_MS = 15 * 60 * 1000;
const ORDER_EXPIRY_TTL_MS = 60 * 60 * 1000;
const STALE_ORDER_PRUNE_MS = 24 * 60 * 60 * 1000;

export function resolveSifaloEndpoints(
  environment: SifaloEnvironment,
  overrides: { gatewayUrl?: string; verifyUrl?: string; checkoutBaseUrl?: string } = {}
): SifaloEndpointConfig {
  const isProd = environment === 'production';
  return {
    environment,
    gatewayUrl:
      overrides.gatewayUrl ||
      (isProd ? 'https://api.sifalopay.com/gateway/' : 'https://staging.sifalopay.com/gateway/'),
    verifyUrl:
      overrides.verifyUrl ||
      (isProd
        ? 'https://api.sifalopay.com/gateway/verify.php'
        : 'https://staging.sifalopay.com/gateway/verify.php'),
    hostedCheckoutBaseUrl:
      overrides.checkoutBaseUrl ||
      (isProd ? 'https://pay.sifalopay.com/checkout/' : 'https://staging.sifalopay.com/checkout/'),
  };
}

function sanitizeShortSlug(val: unknown, fallback = 'default'): string {
  if (typeof val !== 'string') return fallback;
  const cleaned = val.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48);
  return cleaned || fallback;
}

function parseOriginBaseUrl(req: Request, configuredBaseUrl: string): string | null {
  if (configuredBaseUrl) {
    try {
      const parsed = new URL(configuredBaseUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      return null;
    }
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto === 'https' || forwardedProto === 'http' ? forwardedProto : req.protocol;
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();

  if (!host || !/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    return null;
  }
  const safeProto = proto === 'https' ? 'https' : 'http';
  return `${safeProto}://${host}`;
}

function parseAmountToCents(rawAmount: unknown): number | null {
  if (typeof rawAmount === 'number') {
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) return null;
    return Math.round(rawAmount * 100);
  }
  if (typeof rawAmount === 'string') {
    const cleaned = rawAmount.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
    const num = Number(cleaned);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round(num * 100);
  }
  return null;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isSifaloSuccessPayload(payload: Record<string, unknown>): boolean {
  const status = String(payload.status || '').trim().toLowerCase();
  const code = Number(payload.code);
  return status === 'success' && code === 601;
}

function classifyNonSuccessStatus(payload: Record<string, unknown>): OrderStatus | null {
  const status = String(payload.status || '').trim().toLowerCase();
  const code = Number(payload.code);
  if (status === 'cancelled' || status === 'canceled') return 'CANCELLED';
  if (status === 'expired') return 'EXPIRED';
  if (status === 'failed' || status === 'failure' || status === 'error' || code === 600 || code === 604) {
    return 'FAILED';
  }
  if (status === 'pending' || code === 603) return 'PENDING';
  return null;
}

export function createSifaloPaymentService(deps: SifaloPaymentServiceDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const getEnvironment =
    deps.getEnvironment ??
    (() => {
      const raw = String(process.env.SIFALO_ENV || 'staging').trim().toLowerCase();
      return raw === 'production' || raw === 'live' ? 'production' : 'staging';
    });
  const getApiUser = deps.getApiUser ?? (() => String(process.env.SIFALO_API_USER || '').trim());
  const getApiKey = deps.getApiKey ?? (() => String(process.env.SIFALO_API_KEY || '').trim());
  const getWebhookSecret =
    deps.getWebhookSecret ?? (() => String(process.env.SIFALO_WEBHOOK_SECRET || '').trim());
  const getAppBaseUrl = deps.getAppBaseUrl ?? (() => String(process.env.APP_BASE_URL || '').trim());
  const getCustomGatewayUrl =
    deps.getCustomGatewayUrl ?? (() => String(process.env.SIFALO_API_BASE_URL || '').trim());
  const getCustomVerifyUrl =
    deps.getCustomVerifyUrl ?? (() => String(process.env.SIFALO_VERIFY_URL || '').trim());
  const getCustomCheckoutBaseUrl =
    deps.getCustomCheckoutBaseUrl ?? (() => String(process.env.SIFALO_CHECKOUT_URL || '').trim());

  const envSigningKey = String(process.env.UNLOCK_TOKEN_SECRET || '').trim();
  const signingSecret =
    deps.tokenSigningSecret ??
    (envSigningKey ? Buffer.from(envSigningKey, 'utf8') : crypto.randomBytes(32));

  const orders = new Map<string, SifaloOrderRecord>();
  const sidToOrderId = new Map<string, string>();
  const consumedTransactions = new Map<string, string>(); // txRef -> orderId

  function pruneOldOrders() {
    if (orders.size < 500) return;
    const cutoff = now() - STALE_ORDER_PRUNE_MS;
    for (const [id, order] of orders.entries()) {
      if (order.status !== 'PAID' && order.createdAt < cutoff) {
        orders.delete(id);
        if (order.providerSid) sidToOrderId.delete(order.providerSid);
      }
    }
  }

  function buildBasicAuthHeader(apiUser: string, apiKey: string): string {
    return `Basic ${Buffer.from(`${apiUser}:${apiKey}`, 'utf8').toString('base64')}`;
  }

  function computeOrderWebhookToken(orderId: string): string {
    return crypto.createHmac('sha256', signingSecret).update(`wh:${orderId}`, 'utf8').digest('hex');
  }

  function signUnlockToken(payload: {
    tid: string;
    orderId: string;
    productKey: UnlockProductKey;
    exp: number;
  }): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', signingSecret)
      .update(encodedPayload, 'utf8')
      .digest('base64url');
    return `${encodedPayload}.${sig}`;
  }

  function verifyUnlockTokenString(token: string): {
    tid: string;
    orderId: string;
    productKey: UnlockProductKey;
    exp: number;
  } | null {
    if (typeof token !== 'string' || !token.includes('.')) return null;
    const dotIdx = token.indexOf('.');
    const encodedPayload = token.slice(0, dotIdx);
    const providedSig = token.slice(dotIdx + 1);
    if (!encodedPayload || !providedSig || token.indexOf('.', dotIdx + 1) !== -1) {
      return null;
    }

    const expectedSig = crypto
      .createHmac('sha256', signingSecret)
      .update(encodedPayload, 'utf8')
      .digest('base64url');

    if (!constantTimeStringEqual(providedSig, expectedSig)) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (
        !parsed ||
        typeof parsed.tid !== 'string' ||
        typeof parsed.orderId !== 'string' ||
        typeof parsed.productKey !== 'string' ||
        typeof parsed.exp !== 'number'
      ) {
        return null;
      }
      if (!AUTHORITATIVE_PRODUCT_PRICING[parsed.productKey as UnlockProductKey]) {
        return null;
      }
      if (parsed.exp <= now()) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function issueOrderUnlockGrant(order: SifaloOrderRecord) {
    if (order.status !== 'PAID' || !order.unlockTokenId || !order.unlockTokenExpiresAt) {
      return null;
    }
    if (order.unlockTokenExpiresAt <= now()) {
      return null;
    }
    const unlockToken = signUnlockToken({
      tid: order.unlockTokenId,
      orderId: order.orderId,
      productKey: order.productKey,
      exp: order.unlockTokenExpiresAt,
    });
    return {
      unlockToken,
      expiresAt: order.unlockTokenExpiresAt,
    };
  }

  function resolveHostedCheckoutUrl(
    sifaloData: Record<string, unknown>,
    endpoints: SifaloEndpointConfig
  ): string | null {
    const directUrl = [sifaloData.checkout_url, sifaloData.payment_url, sifaloData.url]
      .find((u) => typeof u === 'string' && /^https?:\/\//i.test(u)) as string | undefined;
    if (directUrl) return directUrl;

    const key = typeof sifaloData.key === 'string' ? sifaloData.key.trim() : '';
    const token = typeof sifaloData.token === 'string' ? sifaloData.token.trim() : '';
    if (key && token) {
      const base = endpoints.hostedCheckoutBaseUrl.replace(/\/+$/, '');
      return `${base}/?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
    }
    return null;
  }

  async function verifyTransactionWithSifaloApi(
    order: SifaloOrderRecord,
    candidateSid?: string
  ): Promise<{ ok: boolean; status: OrderStatus; isPending?: boolean; data?: Record<string, unknown>; error?: string }> {
    const apiUser = getApiUser();
    const apiKey = getApiKey();
    if (!apiUser || !apiKey) {
      return { ok: false, status: order.status, error: 'Sifalo Pay credentials are not configured.' };
    }

    const endpoints = resolveSifaloEndpoints(order.environment, {
      gatewayUrl: getCustomGatewayUrl(),
      verifyUrl: getCustomVerifyUrl(),
      checkoutBaseUrl: getCustomCheckoutBaseUrl(),
    });

    const sid = (candidateSid || order.providerSid || '').trim();
    const verifyBody: Record<string, string> = {
      order_id: order.orderId,
    };
    if (sid) {
      verifyBody.sid = sid;
    }

    const res = await fetchImpl(endpoints.verifyUrl, {
      method: 'POST',
      headers: {
        Authorization: buildBasicAuthHeader(apiUser, apiKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(verifyBody),
    });

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !data || typeof data !== 'object') {
      return {
        ok: false,
        status: order.status,
        error: 'Unable to retrieve transaction status from Sifalo Pay.',
      };
    }

    const nonSuccess = classifyNonSuccessStatus(data);
    if (nonSuccess && !isSifaloSuccessPayload(data)) {
      if (order.status === 'PENDING' && nonSuccess !== 'PENDING') {
        order.status = nonSuccess;
        console.info(`[Sifalo] Order status updated: orderId=${order.orderId} status=${order.status}`);
      }
      return {
        ok: false,
        status: nonSuccess,
        isPending: nonSuccess === 'PENDING',
        data,
        error:
          nonSuccess === 'PENDING'
            ? 'Payment is still awaiting confirmation from Sifalo Pay.'
            : `Payment ${nonSuccess.toLowerCase()}.`,
      };
    }

    if (!isSifaloSuccessPayload(data)) {
      return {
        ok: false,
        status: order.status,
        data,
        error: 'Sifalo Pay did not confirm payment success (status=success, code=601 required).',
      };
    }

    // Validate returned order_id if present in verify response
    if (data.order_id !== undefined && String(data.order_id).trim() !== order.orderId) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo order_id does not match this order.',
      };
    }

    // Validate currency and exact authoritative amount
    const returnedCurrency = String(data.currency || '').trim().toUpperCase();
    if (returnedCurrency !== order.currency) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo payment currency mismatch.',
      };
    }

    const paidCents = parseAmountToCents(data.amount);
    if (paidCents !== order.amountCents) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo payment amount does not match product price.',
      };
    }

    const txRef = String(
      data.sid || data.transaction_id || data.reference || sid || `order:${order.orderId}`
    ).trim();

    const existingOwner = consumedTransactions.get(txRef);
    if (existingOwner && existingOwner !== order.orderId) {
      return {
        ok: false,
        status: order.status,
        error: 'This Sifalo Pay transaction has already been consumed by another order.',
      };
    }

    const sidOwner = sid ? sidToOrderId.get(sid) : undefined;
    if (sidOwner && sidOwner !== order.orderId) {
      return {
        ok: false,
        status: order.status,
        error: 'This Sifalo checkout session belongs to another order.',
      };
    }

    // Bind & atomically transition PENDING -> PAID
    if (sid) {
      sidToOrderId.set(sid, order.orderId);
      order.providerSid = sid;
    }
    consumedTransactions.set(txRef, order.orderId);
    order.transactionRef = txRef;

    if (order.status !== 'PAID') {
      const paidAt = now();
      order.status = 'PAID';
      order.paidAt = paidAt;
      order.unlockTokenId = crypto.randomUUID();
      order.unlockTokenExpiresAt = paidAt + UNLOCK_GRANT_TTL_MS;
      console.info(
        `[Sifalo] Order verified PAID: orderId=${order.orderId} product=${order.productKey} amount=$${order.amountUsdString}`
      );
    }

    return { ok: true, status: 'PAID', data };
  }

  function validateWebhookAuthenticity(
    req: Request,
    rawBodyText: string,
    order: SifaloOrderRecord
  ): boolean {
    const queryToken = typeof req.query.wh_token === 'string' ? req.query.wh_token.trim() : '';
    const tokenOk = queryToken ? constantTimeStringEqual(queryToken, order.webhookAuthToken) : false;

    const configuredSecret = getWebhookSecret();
    if (!configuredSecret) {
      return tokenOk;
    }

    const sigHeader = String(req.headers['x-sifalo-signature'] || '').trim();
    const secretHeader = String(req.headers['x-webhook-secret'] || '').trim();
    if (secretHeader && constantTimeStringEqual(secretHeader, configuredSecret)) {
      return true;
    }
    if (sigHeader) {
      const expectedHex = crypto
        .createHmac('sha256', configuredSecret)
        .update(rawBodyText, 'utf8')
        .digest('hex');
      if (constantTimeStringEqual(sigHeader.toLowerCase(), expectedHex.toLowerCase())) {
        return true;
      }
    }
    return tokenOk;
  }

  function createRouter() {
    const router = express.Router();

    router.get('/config', (_req: Request, res: Response) => {
      const environment = getEnvironment();
      const configured = Boolean(getApiUser() && getApiKey());
      return res.json({
        configured,
        provider: 'sifalo',
        environment,
        supportedMethods: [
          'Visa',
          'Mastercard',
          'EVC Plus / Waafi',
          'eDahab',
          'Zaad',
          'SAHAL',
          'Premier Wallet',
        ],
        pricing: AUTHORITATIVE_PRODUCT_PRICING,
      });
    });

    router.post('/create-checkout', async (req: Request, res: Response) => {
      try {
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const productKey = normalizeDocTypeToProductKey(body.docType);
        if (!productKey) {
          return res.status(400).json({ error: 'Unsupported or missing document type.' });
        }

        const apiUser = getApiUser();
        const apiKey = getApiKey();
        if (!apiUser || !apiKey) {
          return res.status(503).json({
            code: 'PAYMENT_NOT_CONFIGURED',
            error:
              'Sifalo Pay checkout requires SIFALO_API_USER and SIFALO_API_KEY to be configured on the server.',
          });
        }

        const baseUrl = parseOriginBaseUrl(req, getAppBaseUrl());
        if (!baseUrl) {
          return res.status(400).json({ error: 'Could not determine a safe return URL origin.' });
        }

        pruneOldOrders();

        // Always determine authoritative price strictly from server product catalog
        const priceSpec = AUTHORITATIVE_PRODUCT_PRICING[productKey];
        const environment = getEnvironment();
        const endpoints = resolveSifaloEndpoints(environment, {
          gatewayUrl: getCustomGatewayUrl(),
          verifyUrl: getCustomVerifyUrl(),
          checkoutBaseUrl: getCustomCheckoutBaseUrl(),
        });

        const countryKey = sanitizeShortSlug(body.countryKey, 'global');
        const providerKey = sanitizeShortSlug(body.providerKey, 'virtual-account');
        const orderId = `KYC-${crypto.randomUUID()}`;
        const webhookAuthToken = computeOrderWebhookToken(orderId);

        const order: SifaloOrderRecord = {
          orderId,
          productKey,
          countryKey,
          providerKey,
          amountCents: priceSpec.amountCents,
          amountUsdString: priceSpec.amountUsdString,
          currency: priceSpec.currency,
          environment,
          status: 'PENDING',
          providerSid: null,
          providerToken: null,
          transactionRef: null,
          webhookAuthToken,
          createdAt: now(),
          paidAt: null,
          unlockTokenId: null,
          unlockTokenExpiresAt: null,
        };
        orders.set(orderId, order);

        const returnUrl = `${baseUrl}/?sifalo_checkout=return&order_id=${encodeURIComponent(orderId)}`;
        const webhookUrl = `${baseUrl}/api/payments/sifalo/webhook?wh_token=${encodeURIComponent(webhookAuthToken)}`;

        const sifaloRequestPayload = {
          order_id: orderId,
          amount: priceSpec.amountUsdString,
          currency: priceSpec.currency,
          gateway: 'checkout',
          return_url: returnUrl,
          webhook_url: webhookUrl,
          channel: 'web',
        };

        const sifaloRes = await fetchImpl(endpoints.gatewayUrl, {
          method: 'POST',
          headers: {
            Authorization: buildBasicAuthHeader(apiUser, apiKey),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sifaloRequestPayload),
        });

        const sifaloJson = (await sifaloRes.json().catch(() => null)) as Record<string, unknown> | null;
        const checkoutUrl = sifaloJson ? resolveHostedCheckoutUrl(sifaloJson, endpoints) : null;

        if (!sifaloRes.ok || !sifaloJson || !checkoutUrl) {
          orders.delete(orderId);
          const providerMessage =
            (sifaloJson && typeof sifaloJson.response === 'string' && sifaloJson.response) ||
            (sifaloJson && typeof sifaloJson.message === 'string' && sifaloJson.message) ||
            'Unable to create Sifalo Pay hosted checkout session.';
          console.warn(
            `[Sifalo] Checkout creation failed: orderId=${orderId} env=${environment} status=${sifaloRes.status}`
          );
          return res.status(502).json({ error: providerMessage });
        }

        const sid = typeof sifaloJson.sid === 'string' ? sifaloJson.sid.trim() : null;
        const token = typeof sifaloJson.token === 'string' ? sifaloJson.token.trim() : null;
        if (sid) {
          order.providerSid = sid;
          sidToOrderId.set(sid, orderId);
        }
        if (token) {
          order.providerToken = token;
        }

        console.info(
          `[Sifalo] Checkout created: orderId=${orderId} product=${productKey} amount=$${priceSpec.amountUsdString} env=${environment}`
        );

        return res.status(200).json({
          orderId: order.orderId,
          checkoutUrl,
          environment,
          productKey: order.productKey,
          amount: priceSpec.amountUsdString,
          amountCents: order.amountCents,
          formattedPrice: priceSpec.formattedPrice,
        });
      } catch (err) {
        console.error('[Sifalo] Create checkout unexpected error:', err instanceof Error ? err.message : err);
        return res.status(500).json({ error: 'Failed to initiate Sifalo Pay checkout.' });
      }
    });

    router.post('/webhook', async (req: Request, res: Response) => {
      try {
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : null;
        if (!body) {
          return res.status(400).json({ error: 'Invalid Sifalo webhook JSON payload.' });
        }

        const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
        if (!orderId) {
          return res.status(400).json({ error: 'Missing order_id in webhook payload.' });
        }

        const order = orders.get(orderId);
        if (!order) {
          return res.status(404).json({ error: 'Referenced order not found.' });
        }

        if (!validateWebhookAuthenticity(req, JSON.stringify(body), order)) {
          console.warn(`[Sifalo] Rejected unauthenticated webhook for orderId=${orderId}`);
          return res.status(401).json({ error: 'Invalid webhook authorization.' });
        }

        const incomingSid =
          typeof body.sid === 'string'
            ? body.sid.trim()
            : typeof body.transaction_id === 'string'
            ? body.transaction_id.trim()
            : '';

        // Prevent duplicate / replayed webhook execution once already paid or consumed
        if (order.status === 'PAID') {
          if (incomingSid && order.providerSid && incomingSid !== order.providerSid) {
            return res.status(409).json({ error: 'Order already paid with a different transaction.' });
          }
          return res.status(200).json({ received: true, duplicate: true, status: 'PAID' });
        }

        const nonSuccess = classifyNonSuccessStatus(body);
        if (nonSuccess && !isSifaloSuccessPayload(body)) {
          if (nonSuccess !== 'PENDING') {
            order.status = nonSuccess;
          }
          console.info(`[Sifalo] Webhook non-success event: orderId=${orderId} status=${order.status}`);
          return res.status(200).json({ received: true, status: order.status });
        }

        if (!isSifaloSuccessPayload(body)) {
          return res.status(400).json({ error: 'Webhook does not indicate success (status=success, code=601).' });
        }

        const incomingCurrency = String(body.currency || '').trim().toUpperCase();
        if (incomingCurrency !== order.currency) {
          return res.status(400).json({ error: 'Webhook currency mismatch.' });
        }

        const incomingCents = parseAmountToCents(body.amount);
        if (incomingCents !== order.amountCents) {
          return res.status(400).json({ error: 'Webhook amount does not match server order price.' });
        }

        if (incomingSid) {
          const existingTxOwner = consumedTransactions.get(incomingSid);
          if (existingTxOwner && existingTxOwner !== order.orderId) {
            return res.status(409).json({ error: 'Transaction already consumed by another order.' });
          }
        }

        // Verify directly with Sifalo Pay Verify API before transitioning order to PAID
        const verification = await verifyTransactionWithSifaloApi(order, incomingSid || undefined);
        if (!verification.ok) {
          return res.status(400).json({ error: verification.error || 'Sifalo verification failed.' });
        }

        return res.status(200).json({ received: true, status: 'PAID', orderId: order.orderId });
      } catch (err) {
        console.error('[Sifalo] Webhook processing error:', err instanceof Error ? err.message : err);
        return res.status(500).json({ error: 'Webhook processing failure.' });
      }
    });

    router.post('/verify-order', async (req: Request, res: Response) => {
      try {
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
        const sid = typeof body.sid === 'string' ? body.sid.trim() : '';

        if (!orderId) {
          return res.status(400).json({ verified: false, error: 'Missing orderId.' });
        }

        const order = orders.get(orderId);
        if (!order) {
          return res.status(404).json({ verified: false, error: 'Payment order not found.' });
        }

        // Handle explicit expiration for pending orders older than 1 hour
        if (order.status === 'PENDING' && now() - order.createdAt > ORDER_EXPIRY_TTL_MS) {
          order.status = 'EXPIRED';
        }

        if (order.status === 'FAILED' || order.status === 'CANCELLED' || order.status === 'EXPIRED') {
          return res.status(402).json({
            verified: false,
            status: order.status,
            error: `Payment ${order.status.toLowerCase()}. Please start a new payment or complete an offer.`,
          });
        }

        // If webhook did not mark it PAID yet, confirm server-to-server with Sifalo Verify API
        if (order.status === 'PENDING') {
          const check = await verifyTransactionWithSifaloApi(order, sid || undefined);
          if (!check.ok) {
            const httpCode = check.isPending ? 202 : 402;
            return res.status(httpCode).json({
              verified: false,
              status: check.status,
              error: check.error || 'Payment not confirmed yet.',
            });
          }
        }

        const grant = issueOrderUnlockGrant(order);
        if (!grant) {
          return res.status(403).json({
            verified: false,
            status: 'EXPIRED',
            error: 'Paid unlock session has expired. Please start a new unlock.',
          });
        }

        const priceSpec = AUTHORITATIVE_PRODUCT_PRICING[order.productKey];
        return res.status(200).json({
          verified: true,
          status: 'PAID',
          orderId: order.orderId,
          productKey: order.productKey,
          label: priceSpec.label,
          amount: priceSpec.amountUsdString,
          amountCents: order.amountCents,
          formattedPrice: priceSpec.formattedPrice,
          unlockToken: grant.unlockToken,
          expiresAt: grant.expiresAt,
        });
      } catch (err) {
        console.error('[Sifalo] Verify order error:', err instanceof Error ? err.message : err);
        return res.status(500).json({ verified: false, error: 'Failed to verify Sifalo payment.' });
      }
    });

    router.get('/order-status', async (req: Request, res: Response) => {
      const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : '';
      const order = orders.get(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }
      if (order.status === 'PENDING' && now() - order.createdAt > ORDER_EXPIRY_TTL_MS) {
        order.status = 'EXPIRED';
      }
      const priceSpec = AUTHORITATIVE_PRODUCT_PRICING[order.productKey];
      return res.json({
        orderId: order.orderId,
        status: order.status,
        productKey: order.productKey,
        label: priceSpec.label,
        formattedPrice: priceSpec.formattedPrice,
        verified: order.status === 'PAID',
      });
    });

    router.post('/authorize-unlock', (req: Request, res: Response) => {
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const unlockToken = typeof body.unlockToken === 'string' ? body.unlockToken.trim() : '';
      const requestedProductKey = normalizeDocTypeToProductKey(body.docType);

      if (!unlockToken || !requestedProductKey) {
        return res.status(400).json({ authorized: false, error: 'Missing unlock token or document type.' });
      }

      const payload = verifyUnlockTokenString(unlockToken);
      if (!payload) {
        return res.status(401).json({ authorized: false, error: 'Invalid or expired unlock token.' });
      }

      if (payload.productKey !== requestedProductKey) {
        return res.status(403).json({
          authorized: false,
          error: 'Unlock token is not valid for this document category.',
        });
      }

      const order = orders.get(payload.orderId);
      if (
        !order ||
        order.status !== 'PAID' ||
        order.productKey !== payload.productKey ||
        order.unlockTokenId !== payload.tid ||
        !order.unlockTokenExpiresAt ||
        order.unlockTokenExpiresAt <= now()
      ) {
        return res.status(403).json({ authorized: false, error: 'Paid order verification is no longer active.' });
      }

      return res.json({
        authorized: true,
        orderId: order.orderId,
        productKey: order.productKey,
        expiresAt: order.unlockTokenExpiresAt,
      });
    });

    return router;
  }

  return {
    createRouter,
    _internal: {
      orders,
      sidToOrderId,
      consumedTransactions,
      verifyUnlockTokenString,
      computeOrderWebhookToken,
    },
  };
}
