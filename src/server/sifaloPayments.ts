import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type Request, type Response } from 'express';

export type UnlockProductKey =
  | 'passport'
  | 'nationalIdentity'
  | 'driverLicense'
  | 'proofOfAddress'
  | 'proofOfAccount';

export type SifaloEnvironment = 'staging' | 'production';
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'REVERSED';

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
    case 'account':
    case 'bankdocument':
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
  revokedAt?: number | null;
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
  persistenceFilePath?: string | null;
  getPersistentDataDir?: () => string;
  now?: () => number;
}

interface SignedOrderPayload {
  orderId: string;
  productKey: UnlockProductKey;
  countryKey: string;
  providerKey: string;
  amountCents: number;
  amountUsdString: string;
  currency: 'USD';
  environment: SifaloEnvironment;
  providerSid: string | null;
  createdAt: number;
}

interface UnlockTokenPayload {
  tid: string;
  orderId: string;
  productKey: UnlockProductKey;
  exp: number;
}

const UNLOCK_GRANT_TTL_MS = 60 * 60 * 1000;
const ORDER_EXPIRY_TTL_MS = 60 * 60 * 1000;
const STALE_ORDER_PRUNE_MS = 24 * 60 * 60 * 1000;
const MAX_PROCESSED_WEBHOOK_EVENTS = 5000;

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

function extractRawPayloadStatus(payload: Record<string, unknown>): string {
  const candidates = [payload.status, payload.payment_status, payload.transaction_status];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) {
      return val.trim().toLowerCase();
    }
  }
  return '';
}

function isSifaloSuccessPayload(payload: Record<string, unknown>): boolean {
  const status = extractRawPayloadStatus(payload);
  const code = Number(payload.code);
  return status === 'success' && code === 601;
}

function classifyNonSuccessStatus(payload: Record<string, unknown>): OrderStatus | null {
  const status = extractRawPayloadStatus(payload);
  const code = Number(payload.code);
  if (
    status === 'refunded' ||
    status === 'refund' ||
    status === 'partially_refunded' ||
    status === 'chargeback' ||
    status === 'charge_back'
  ) {
    return 'REFUNDED';
  }
  if (status === 'reversed' || status === 'reversal' || status === 'voided' || status === 'void') {
    return 'REVERSED';
  }
  if (status === 'cancelled' || status === 'canceled') return 'CANCELLED';
  if (status === 'expired') return 'EXPIRED';
  if (
    status === 'failed' ||
    status === 'failure' ||
    status === 'error' ||
    status === 'declined' ||
    code === 600 ||
    code === 604
  ) {
    return 'FAILED';
  }
  if (status === 'pending' || code === 603) return 'PENDING';
  return null;
}

function extractIncomingProductId(payload: Record<string, unknown>): string {
  const metadata =
    payload.metadata && typeof payload.metadata === 'object'
      ? (payload.metadata as Record<string, unknown>)
      : null;
  const candidates = [
    payload.product_id,
    payload.productId,
    payload.product_key,
    payload.productKey,
    payload.doc_type,
    payload.docType,
    metadata?.productKey,
    metadata?.product_key,
    metadata?.productId,
    metadata?.product_id,
    metadata?.docType,
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return '';
}

function resolveDefaultPersistencePath(customDir: string): string {
  if (customDir) {
    return path.resolve(customDir, 'sifalo-payments.json');
  }
  const projectDataDir = path.resolve(process.cwd(), '.data');
  try {
    fs.mkdirSync(projectDataDir, { recursive: true });
    fs.accessSync(projectDataDir, fs.constants.W_OK);
    return path.join(projectDataDir, 'sifalo-payments.json');
  } catch {
    return path.join(os.tmpdir(), 'kycapproved-sifalo-payments.json');
  }
}

export function createSifaloPaymentService(deps: SifaloPaymentServiceDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const getEnvironment =
    deps.getEnvironment ??
    (() => {
      const raw = String(process.env.SIFALO_ENV || 'production').trim().toLowerCase();
      return raw === 'staging' || raw === 'test' || raw === 'sandbox' ? 'staging' : 'production';
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
  const getPersistentDataDir =
    deps.getPersistentDataDir ?? (() => String(process.env.SIFALO_DATA_DIR || '').trim());

  // Derive deterministic server-side signing secret from configured Sifalo credentials so stateless Vercel requests verify seamlessly
  const fallbackProcessSecret = crypto.randomBytes(32);
  function getSigningSecret(): Buffer {
    if (deps.tokenSigningSecret) return deps.tokenSigningSecret;
    const rawKey = (getWebhookSecret() || getApiKey() || getApiUser() || '').trim();
    if (rawKey) {
      return crypto.createHash('sha256').update(`kycapproved:sifalo:${rawKey}`).digest();
    }
    return fallbackProcessSecret;
  }

  const orders = new Map<string, SifaloOrderRecord>();
  const sidToOrderId = new Map<string, string>();
  const consumedTransactions = new Map<string, string>(); // txRef -> orderId
  const processedWebhookEvents = new Set<string>();

  const resolvedPersistencePath =
    deps.persistenceFilePath === null
      ? null
      : deps.persistenceFilePath
      ? path.resolve(deps.persistenceFilePath)
      : resolveDefaultPersistencePath(getPersistentDataDir());

  function loadPersistedState() {
    if (!resolvedPersistencePath) return;
    try {
      if (!fs.existsSync(resolvedPersistencePath)) return;
      const raw = fs.readFileSync(resolvedPersistencePath, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as {
        orders?: SifaloOrderRecord[];
        consumedTransactions?: Array<[string, string]>;
        processedWebhookEvents?: string[];
      };
      if (Array.isArray(parsed.orders)) {
        for (const ord of parsed.orders) {
          if (ord && typeof ord.orderId === 'string') {
            orders.set(ord.orderId, ord);
            if (ord.providerSid) {
              sidToOrderId.set(ord.providerSid, ord.orderId);
            }
          }
        }
      }
      if (Array.isArray(parsed.consumedTransactions)) {
        for (const entry of parsed.consumedTransactions) {
          if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string') {
            consumedTransactions.set(entry[0], entry[1]);
          }
        }
      }
      if (Array.isArray(parsed.processedWebhookEvents)) {
        for (const ev of parsed.processedWebhookEvents) {
          if (typeof ev === 'string') {
            processedWebhookEvents.add(ev);
          }
        }
      }
    } catch (err) {
      console.warn('[Sifalo] Could not load persisted state:', err instanceof Error ? err.message : err);
    }
  }

  function persistState() {
    if (!resolvedPersistencePath) return;
    try {
      const dir = path.dirname(resolvedPersistencePath);
      fs.mkdirSync(dir, { recursive: true });
      const payload = {
        orders: Array.from(orders.values()),
        consumedTransactions: Array.from(consumedTransactions.entries()),
        processedWebhookEvents: Array.from(processedWebhookEvents.values()).slice(-MAX_PROCESSED_WEBHOOK_EVENTS),
      };
      const tmpFile = `${resolvedPersistencePath}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf8');
      fs.renameSync(tmpFile, resolvedPersistencePath);
    } catch (err) {
      console.warn('[Sifalo] Could not write persisted state:', err instanceof Error ? err.message : err);
    }
  }

  loadPersistedState();

  function computeOrderWebhookToken(orderId: string): string {
    const secret = getWebhookSecret() || getSigningSecret().toString('hex');
    return crypto
      .createHmac('sha256', secret)
      .update(`sifalo:wh:${orderId}`)
      .digest('hex');
  }

  function signOrderStateToken(order: SifaloOrderRecord): string {
    const payload: SignedOrderPayload = {
      orderId: order.orderId,
      productKey: order.productKey,
      countryKey: order.countryKey,
      providerKey: order.providerKey,
      amountCents: order.amountCents,
      amountUsdString: order.amountUsdString,
      currency: order.currency,
      environment: order.environment,
      providerSid: order.providerSid,
      createdAt: order.createdAt,
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(`ord:${encoded}`)
      .digest('base64url');
    return `${encoded}.${sig}`;
  }

  function recoverOrderFromStateToken(token: string, expectedOrderId?: string): SifaloOrderRecord | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(`ord:${encoded}`)
      .digest('base64url');
    if (!constantTimeStringEqual(providedSig, expectedSig)) return null;

    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedOrderPayload;
      if (
        !parsed ||
        typeof parsed.orderId !== 'string' ||
        typeof parsed.productKey !== 'string' ||
        !AUTHORITATIVE_PRODUCT_PRICING[parsed.productKey as UnlockProductKey] ||
        typeof parsed.amountCents !== 'number' ||
        typeof parsed.createdAt !== 'number'
      ) {
        return null;
      }
      if (expectedOrderId && parsed.orderId !== expectedOrderId) {
        return null;
      }
      const existing = orders.get(parsed.orderId);
      if (existing) {
        if (!existing.providerSid && parsed.providerSid) {
          existing.providerSid = parsed.providerSid;
          sidToOrderId.set(parsed.providerSid, existing.orderId);
        }
        return existing;
      }
      const priceSpec = AUTHORITATIVE_PRODUCT_PRICING[parsed.productKey];
      const recovered: SifaloOrderRecord = {
        orderId: parsed.orderId,
        productKey: parsed.productKey,
        countryKey: sanitizeShortSlug(parsed.countryKey, 'global'),
        providerKey: sanitizeShortSlug(parsed.providerKey, 'virtual-account'),
        amountCents: priceSpec.amountCents,
        amountUsdString: priceSpec.amountUsdString,
        currency: 'USD',
        environment: parsed.environment === 'staging' ? 'staging' : 'production',
        status: 'PENDING',
        providerSid: parsed.providerSid || null,
        providerToken: null,
        transactionRef: null,
        webhookAuthToken: computeOrderWebhookToken(parsed.orderId),
        createdAt: parsed.createdAt,
        paidAt: null,
        revokedAt: null,
        unlockTokenId: null,
        unlockTokenExpiresAt: null,
      };
      orders.set(recovered.orderId, recovered);
      if (recovered.providerSid) {
        sidToOrderId.set(recovered.providerSid, recovered.orderId);
      }
      persistState();
      return recovered;
    } catch {
      return null;
    }
  }

  function pruneOldOrders() {
    const cutoff = now() - STALE_ORDER_PRUNE_MS;
    let changed = false;
    for (const [id, record] of orders.entries()) {
      if (record.createdAt < cutoff) {
        if (record.providerSid) sidToOrderId.delete(record.providerSid);
        orders.delete(id);
        changed = true;
      }
    }
    if (changed) persistState();
  }

  function buildBasicAuthHeader(apiUser: string, apiKey: string): string {
    const encoded = Buffer.from(`${apiUser}:${apiKey}`, 'utf8').toString('base64');
    return `Basic ${encoded}`;
  }

  function signUnlockToken(payload: UnlockTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  function verifyUnlockTokenString(token: string): UnlockTokenPayload | null {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(encodedPayload)
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
      return parsed as UnlockTokenPayload;
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

  function invalidateOrderUnlock(order: SifaloOrderRecord, nextStatus: OrderStatus) {
    order.status = nextStatus;
    order.revokedAt = now();
    order.unlockTokenId = null;
    order.unlockTokenExpiresAt = null;
    orders.set(order.orderId, order);
    persistState();
    console.info(
      `[Sifalo] Order invalidated (${nextStatus}): orderId=${order.orderId} product=${order.productKey}`
    );
  }

  async function verifyTransactionWithSifaloApi(
    order: SifaloOrderRecord,
    overrideSid?: string
  ): Promise<{
    ok: boolean;
    status: OrderStatus;
    isPending?: boolean;
    error?: string;
    data?: Record<string, unknown>;
  }> {
    if (order.status === 'REFUNDED' || order.status === 'REVERSED') {
      return {
        ok: false,
        status: order.status,
        error: `Payment ${order.status.toLowerCase()}. Document download is not permitted.`,
      };
    }

    const apiUser = getApiUser();
    const apiKey = getApiKey();
    if (!apiUser || !apiKey) {
      return {
        ok: false,
        status: order.status,
        error: 'Sifalo Pay server credentials (SIFALO_API_USER / SIFALO_API_KEY) are not configured.',
      };
    }

    const endpoints = resolveSifaloEndpoints(order.environment, {
      gatewayUrl: getCustomGatewayUrl(),
      verifyUrl: getCustomVerifyUrl(),
      checkoutBaseUrl: getCustomCheckoutBaseUrl(),
    });

    const sidToVerify = (overrideSid || order.providerSid || '').trim();
    const verifyBody: Record<string, string> = sidToVerify
      ? { sid: sidToVerify, order_id: order.orderId }
      : { order_id: order.orderId };

    let res: globalThis.Response;
    try {
      res = await fetchImpl(endpoints.verifyUrl, {
        method: 'POST',
        headers: {
          Authorization: buildBasicAuthHeader(apiUser, apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verifyBody),
      });
    } catch {
      return {
        ok: false,
        status: order.status,
        isPending: order.status === 'PENDING',
        error: 'Could not reach Sifalo Pay verification gateway.',
      };
    }

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !data) {
      return {
        ok: false,
        status: order.status,
        isPending: order.status === 'PENDING',
        error: 'Invalid verification response from Sifalo Pay.',
      };
    }

    const nonSuccess = classifyNonSuccessStatus(data);
    if (nonSuccess && !isSifaloSuccessPayload(data)) {
      if (nonSuccess === 'REFUNDED' || nonSuccess === 'REVERSED') {
        invalidateOrderUnlock(order, nonSuccess);
      } else if (nonSuccess !== 'PENDING' && order.status === 'PENDING') {
        order.status = nonSuccess;
        orders.set(order.orderId, order);
        persistState();
      }
      return {
        ok: false,
        status: order.status,
        isPending: nonSuccess === 'PENDING',
        error:
          nonSuccess === 'PENDING'
            ? 'Payment is still awaiting confirmation from Sifalo Pay.'
            : `Payment ${nonSuccess.toLowerCase()}.`,
        data,
      };
    }

    if (!isSifaloSuccessPayload(data)) {
      return {
        ok: false,
        status: order.status,
        isPending: order.status === 'PENDING',
        error: 'Sifalo Pay did not confirm payment success (status=success, code=601 required).',
        data,
      };
    }

    // Strict order binding check
    const returnedOrderId = typeof data.order_id === 'string' ? data.order_id.trim() : '';
    if (returnedOrderId && returnedOrderId !== order.orderId) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo transaction belongs to a different order ID.',
      };
    }

    const returnedProductRaw = extractIncomingProductId(data);
    if (returnedProductRaw) {
      const normalizedProduct = normalizeDocTypeToProductKey(returnedProductRaw);
      if (normalizedProduct !== order.productKey) {
        return {
          ok: false,
          status: order.status,
          error: 'Verified Sifalo product type does not match order document.',
        };
      }
    }

    const returnedCurrency =
      typeof data.currency === 'string' && data.currency.trim()
        ? data.currency.trim().toUpperCase()
        : order.currency;
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

    const verifiedSid =
      typeof data.sid === 'string' && data.sid.trim()
        ? data.sid.trim()
        : typeof data.transaction_id === 'string' && data.transaction_id.trim()
        ? data.transaction_id.trim()
        : sidToVerify;

    if (order.providerSid && verifiedSid && order.providerSid !== verifiedSid) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo transaction SID does not match order SID.',
      };
    }

    if (verifiedSid) {
      const existingOwner = consumedTransactions.get(verifiedSid);
      if (existingOwner && existingOwner !== order.orderId) {
        return {
          ok: false,
          status: order.status,
          error: 'This Sifalo checkout session belongs to another order.',
        };
      }
      consumedTransactions.set(verifiedSid, order.orderId);
      sidToOrderId.set(verifiedSid, order.orderId);
      order.providerSid = verifiedSid;
      order.transactionRef = verifiedSid;
    }

    // Bind & atomically transition PENDING -> PAID
    if (order.status !== 'PAID') {
      const paidAt = now();
      order.status = 'PAID';
      order.paidAt = paidAt;
      order.revokedAt = null;
      order.unlockTokenId = crypto.randomUUID();
      order.unlockTokenExpiresAt = paidAt + UNLOCK_GRANT_TTL_MS;
      orders.set(order.orderId, order);
      persistState();
      console.info(
        `[Sifalo] Order verified PAID: orderId=${order.orderId} product=${order.productKey} amount=$${order.amountUsdString}`
      );
    }

    return { ok: true, status: 'PAID', data };
  }

  function extractRawBodyString(req: Request): string {
    const rawBuf = (req as Request & { rawBody?: Buffer }).rawBody;
    if (Buffer.isBuffer(rawBuf)) {
      return rawBuf.toString('utf8');
    }
    if (typeof req.body === 'string') {
      return req.body;
    }
    if (req.body && typeof req.body === 'object') {
      return JSON.stringify(req.body);
    }
    return '';
  }

  function verifyHmacSignatureHeader(req: Request, rawBodyText: string, secret: string): boolean {
    if (!secret || !rawBodyText) return false;
    const rawHeader = String(
      req.headers['x-sifalo-signature'] ||
        req.headers['x-webhook-signature'] ||
        req.headers['x-signature'] ||
        ''
    ).trim();
    if (!rawHeader) return false;

    const normalizedSig = rawHeader.replace(/^sha256=/i, '').trim();
    const expectedHex = crypto.createHmac('sha256', secret).update(rawBodyText, 'utf8').digest('hex');
    const expectedBase64 = crypto
      .createHmac('sha256', secret)
      .update(rawBodyText, 'utf8')
      .digest('base64');

    return (
      constantTimeStringEqual(normalizedSig.toLowerCase(), expectedHex.toLowerCase()) ||
      constantTimeStringEqual(normalizedSig, expectedBase64)
    );
  }

  function validateWebhookAuthenticity(
    req: Request,
    rawBodyText: string,
    order: SifaloOrderRecord
  ): { authenticated: boolean; requiresProviderVerificationOnly?: boolean } {
    const webhookSecret = getWebhookSecret();
    const hasSignatureHeader = Boolean(
      req.headers['x-sifalo-signature'] ||
        req.headers['x-webhook-signature'] ||
        req.headers['x-signature']
    );

    if (hasSignatureHeader) {
      const secretToUse = webhookSecret || getSigningSecret().toString('hex');
      return { authenticated: verifyHmacSignatureHeader(req, rawBodyText, secretToUse) };
    }

    const queryToken = typeof req.query.wh_token === 'string' ? req.query.wh_token.trim() : '';
    const headerToken = String(req.headers['x-sifalo-webhook-token'] || '').trim();
    const candidateToken = queryToken || headerToken;

    if (candidateToken) {
      if (constantTimeStringEqual(candidateToken, order.webhookAuthToken)) {
        return { authenticated: true };
      }
      if (webhookSecret && constantTimeStringEqual(candidateToken, webhookSecret)) {
        return { authenticated: true };
      }
      return { authenticated: false };
    }

    if (webhookSecret) {
      return { authenticated: false };
    }

    // No signature header or wh_token (e.g. static Sifalo Dashboard webhook URL when SIFALO_WEBHOOK_SECRET is not set):
    // allow ONLY if verified server-to-server against Sifalo's authenticated verify.php API.
    return { authenticated: true, requiresProviderVerificationOnly: true };
  }

  async function handleWebhook(req: Request, res: Response) {
    try {
      loadPersistedState();
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : null;
      if (!body) {
        return res.status(400).json({ error: 'Invalid Sifalo webhook JSON payload.' });
      }

      const orderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
      if (!orderId) {
        return res.status(400).json({ error: 'Missing order_id in webhook payload.' });
      }

      const queryOrderState = typeof req.query.order_state === 'string' ? req.query.order_state.trim() : '';
      const order = orders.get(orderId) || recoverOrderFromStateToken(queryOrderState, orderId);
      if (!order) {
        return res.status(404).json({ error: 'Referenced order not found.' });
      }

      const rawBodyText = extractRawBodyString(req);
      const authResult = validateWebhookAuthenticity(req, rawBodyText, order);
      if (!authResult.authenticated) {
        console.warn(`[Sifalo] Rejected unauthenticated webhook for orderId=${orderId}`);
        return res.status(401).json({ error: 'Invalid webhook authorization.' });
      }

      const incomingProductRaw = extractIncomingProductId(body);
      if (incomingProductRaw) {
        const normalizedProduct = normalizeDocTypeToProductKey(incomingProductRaw);
        if (normalizedProduct !== order.productKey) {
          return res.status(400).json({ error: 'Webhook product/document ID mismatch.' });
        }
      }

      const incomingSid =
        typeof body.sid === 'string'
          ? body.sid.trim()
          : typeof body.transaction_id === 'string'
          ? body.transaction_id.trim()
          : '';

      const rawStatusSlug = extractRawPayloadStatus(body) || 'unknown';
      const rawCodeSlug = body.code !== undefined ? String(body.code) : 'nocode';
      const rawAmountSlug = body.amount !== undefined ? String(body.amount) : 'noamt';
      const rawEventId = String(body.event_id || body.webhook_id || '').trim();
      const eventKey = `${orderId}:${incomingSid || 'nosid'}:${rawStatusSlug}:${rawCodeSlug}:${rawAmountSlug}:${rawEventId}`;

      if (processedWebhookEvents.has(eventKey)) {
        return res.status(200).json({ received: true, duplicate: true, status: order.status });
      }

      const nonSuccess = classifyNonSuccessStatus(body);

      // If no cryptographic webhook token/header was sent, verify state directly with Sifalo Verify API before mutating non-success state
      if (authResult.requiresProviderVerificationOnly && nonSuccess && !isSifaloSuccessPayload(body)) {
        const providerCheck = await verifyTransactionWithSifaloApi(order, incomingSid || undefined);
        if (providerCheck.ok) {
          processedWebhookEvents.add(eventKey);
          persistState();
          return res.status(200).json({
            received: true,
            status: 'PAID',
            orderId: order.orderId,
            productKey: order.productKey,
          });
        }
        if (!providerCheck.data || classifyNonSuccessStatus(providerCheck.data) !== nonSuccess) {
          return res.status(401).json({ error: 'Unauthenticated webhook could not be confirmed with Sifalo Verify API.' });
        }
      }

      // Handle refunds / reversals / chargebacks BEFORE checking PAID idempotency so previously paid orders are revoked
      if (nonSuccess === 'REFUNDED' || nonSuccess === 'REVERSED') {
        if (incomingSid && order.providerSid && incomingSid !== order.providerSid) {
          return res.status(409).json({ error: 'Refund/reversal transaction ID does not match original order.' });
        }
        if (order.status === nonSuccess) {
          processedWebhookEvents.add(eventKey);
          persistState();
          return res.status(200).json({ received: true, duplicate: true, status: order.status });
        }
        invalidateOrderUnlock(order, nonSuccess);
        processedWebhookEvents.add(eventKey);
        persistState();
        return res.status(200).json({
          received: true,
          status: order.status,
          orderId: order.orderId,
          productKey: order.productKey,
          revoked: true,
        });
      }

      if (order.status === 'REFUNDED' || order.status === 'REVERSED') {
        processedWebhookEvents.add(eventKey);
        persistState();
        return res.status(409).json({
          error: `Order is ${order.status.toLowerCase()} and cannot authorize downloads.`,
          status: order.status,
        });
      }

      // Prevent duplicate / replayed webhook execution once already paid
      if (order.status === 'PAID') {
        if (incomingSid && order.providerSid && incomingSid !== order.providerSid) {
          return res.status(409).json({ error: 'Order already paid with a different transaction.' });
        }
        processedWebhookEvents.add(eventKey);
        persistState();
        return res.status(200).json({ received: true, duplicate: true, status: 'PAID' });
      }

      if (nonSuccess && !isSifaloSuccessPayload(body)) {
        if (nonSuccess !== 'PENDING' && order.status === 'PENDING') {
          order.status = nonSuccess;
          orders.set(order.orderId, order);
        }
        processedWebhookEvents.add(eventKey);
        persistState();
        console.info(`[Sifalo] Webhook non-success event: orderId=${orderId} status=${order.status}`);
        return res.status(200).json({ received: true, status: order.status });
      }

      if (!isSifaloSuccessPayload(body)) {
        return res.status(400).json({ error: 'Webhook does not indicate success (status=success, code=601).' });
      }

      const rawCurrency = typeof body.currency === 'string' ? body.currency.trim() : '';
      const incomingCurrency = rawCurrency ? rawCurrency.toUpperCase() : order.currency;
      if (incomingCurrency !== order.currency) {
        console.warn(`[Sifalo] Webhook rejected (currency mismatch): orderId=${orderId}`);
        return res.status(400).json({ error: 'Webhook currency mismatch.' });
      }

      const incomingCents = parseAmountToCents(body.amount);
      if (incomingCents !== order.amountCents) {
        console.warn(`[Sifalo] Webhook rejected (amount mismatch): orderId=${orderId}`);
        return res.status(400).json({ error: 'Webhook amount does not match server order price.' });
      }

      if (incomingSid) {
        const existingTxOwner = consumedTransactions.get(incomingSid);
        if (existingTxOwner && existingTxOwner !== order.orderId) {
          console.warn(`[Sifalo] Webhook rejected (transaction already consumed): orderId=${orderId}`);
          return res.status(409).json({ error: 'Transaction already consumed by another order.' });
        }
      }

      // Verify directly with Sifalo Pay Verify API before transitioning order to PAID
      const verification = await verifyTransactionWithSifaloApi(order, incomingSid || undefined);
      if (!verification.ok) {
        console.warn(`[Sifalo] Webhook rejected (provider verification failed): orderId=${orderId}`);
        return res.status(400).json({ error: verification.error || 'Sifalo verification failed.' });
      }

      processedWebhookEvents.add(eventKey);
      persistState();
      console.info(
        `[Sifalo] Webhook processed PAID: orderId=${order.orderId} product=${order.productKey} amount=$${order.amountUsdString}`
      );
      return res.status(200).json({
        received: true,
        status: 'PAID',
        orderId: order.orderId,
        productKey: order.productKey,
      });
    } catch (err) {
      console.error('[Sifalo] Webhook processing error:', err instanceof Error ? err.message : err);
      return res.status(500).json({ error: 'Webhook processing failure.' });
    }
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
        loadPersistedState();
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const productKey = normalizeDocTypeToProductKey(
          body.docType ?? body.productKey ?? body.productCategory
        );
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
          revokedAt: null,
          unlockTokenId: null,
          unlockTokenExpiresAt: null,
        };
        orders.set(orderId, order);

        const prelimStateToken = signOrderStateToken(order);
        const returnUrl = `${baseUrl}/?sifalo_checkout=return&order_id=${encodeURIComponent(orderId)}&order_state=${encodeURIComponent(prelimStateToken)}`;
        const webhookUrl = `${baseUrl}/api/webhooks/sifalo?wh_token=${encodeURIComponent(webhookAuthToken)}&order_state=${encodeURIComponent(prelimStateToken)}`;

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
        orders.set(orderId, order);
        persistState();

        const orderStateToken = signOrderStateToken(order);

        console.info(
          `[Sifalo] Checkout created: orderId=${orderId} product=${productKey} amount=$${priceSpec.amountUsdString} env=${environment}`
        );

        return res.status(200).json({
          orderId: order.orderId,
          orderStateToken,
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

    router.post('/webhook', handleWebhook);

    router.post('/verify-order', async (req: Request, res: Response) => {
      try {
        loadPersistedState();
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
        const sid = typeof body.sid === 'string' ? body.sid.trim() : '';
        const orderStateToken =
          typeof body.orderStateToken === 'string' ? body.orderStateToken.trim() : '';

        if (!orderId) {
          return res.status(400).json({ verified: false, error: 'Missing orderId.' });
        }

        const order = orders.get(orderId) || recoverOrderFromStateToken(orderStateToken, orderId);
        if (!order) {
          return res.status(404).json({ verified: false, error: 'Payment order not found.' });
        }

        // Handle explicit expiration for pending orders older than 1 hour
        if (order.status === 'PENDING' && now() - order.createdAt > ORDER_EXPIRY_TTL_MS) {
          order.status = 'EXPIRED';
          orders.set(order.orderId, order);
          persistState();
        }

        if (
          order.status === 'FAILED' ||
          order.status === 'CANCELLED' ||
          order.status === 'EXPIRED' ||
          order.status === 'REFUNDED' ||
          order.status === 'REVERSED'
        ) {
          return res.status(402).json({
            verified: false,
            status: order.status,
            productKey: order.productKey,
            orderId: order.orderId,
            error: `Payment ${order.status.toLowerCase()}. Please start a new payment.`,
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
            error: 'Paid session has expired. Please start a new payment.',
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

    router.get('/order-status', (req: Request, res: Response) => {
      loadPersistedState();
      const orderId = typeof req.query.orderId === 'string' ? req.query.orderId.trim() : '';
      const orderStateToken =
        typeof req.query.orderStateToken === 'string' ? req.query.orderStateToken.trim() : '';
      const order = orderId
        ? orders.get(orderId) || recoverOrderFromStateToken(orderStateToken, orderId)
        : null;
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }
      if (order.status === 'PENDING' && now() - order.createdAt > ORDER_EXPIRY_TTL_MS) {
        order.status = 'EXPIRED';
        orders.set(order.orderId, order);
        persistState();
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
      loadPersistedState();
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const unlockToken = typeof body.unlockToken === 'string' ? body.unlockToken.trim() : '';
      const requestedProductKey = normalizeDocTypeToProductKey(
        body.docType ?? body.productKey ?? body.productCategory
      );

      if (!unlockToken || !requestedProductKey) {
        return res.status(400).json({ authorized: false, error: 'Missing payment token or document type.' });
      }

      const payload = verifyUnlockTokenString(unlockToken);
      if (!payload) {
        return res.status(401).json({ authorized: false, error: 'Invalid or expired payment authorization token.' });
      }

      if (payload.productKey !== requestedProductKey) {
        return res.status(403).json({
          authorized: false,
          error: 'Payment authorization is not valid for this document category.',
        });
      }

      const order = orders.get(payload.orderId);
      if (order) {
        if (
          order.status !== 'PAID' ||
          order.productKey !== payload.productKey ||
          order.unlockTokenId !== payload.tid ||
          !order.unlockTokenExpiresAt ||
          order.unlockTokenExpiresAt <= now()
        ) {
          return res.status(403).json({ authorized: false, error: 'Paid order verification is no longer active.' });
        }
      }

      return res.json({
        authorized: true,
        orderId: payload.orderId,
        productKey: payload.productKey,
        expiresAt: payload.exp,
      });
    });

    return router;
  }

  return {
    createRouter,
    handleWebhook,
    _internal: {
      orders,
      sidToOrderId,
      consumedTransactions,
      processedWebhookEvents,
      verifyUnlockTokenString,
      computeOrderWebhookToken,
      signOrderStateToken,
      recoverOrderFromStateToken,
    },
  };
}
