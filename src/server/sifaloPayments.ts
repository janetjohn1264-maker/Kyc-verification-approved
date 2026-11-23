import crypto from 'node:crypto';
import dns from 'node:dns';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type Request, type Response } from 'express';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported in current Node runtime
}

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
  sifaloHostedMethods: Array<'card' | 'mobile_money'>;
  sifaloCardSupported: boolean;
  sifaloMethodRuleNote: string;
}

// Sifalo Pay's hosted checkout script (https://pay.sifalo.com/checkout/js/checkout.js -> checkTabs)
// enforces: `if (currency == "USD" && convertToCents(amountToPay) > 51)` to enable Card (Stripe/MPGS).
// For USD amounts <= $0.51 (51 cents), Sifalo hides Card/MPGS tabs and displays Mobile Money only.
export const SIFALO_CARD_MIN_AMOUNT_CENTS = 52;

// Authoritative server-side pricing table. Never trust prices sent by the browser.
export const AUTHORITATIVE_PRODUCT_PRICING: Record<UnlockProductKey, ProductPriceSpec> = {
  passport: {
    productKey: 'passport',
    label: 'Passport',
    amountCents: 111,
    amountUsdString: '1.11',
    formattedPrice: '$1.11',
    currency: 'USD',
    sifaloHostedMethods: ['card', 'mobile_money'],
    sifaloCardSupported: true,
    sifaloMethodRuleNote:
      'Amount is $1.11 (111 cents > 51 cents threshold in Sifalo checkout.js), so Sifalo displays both Card and Mobile Money.',
  },
  nationalIdentity: {
    productKey: 'nationalIdentity',
    label: 'National Identity Card',
    amountCents: 50,
    amountUsdString: '0.50',
    formattedPrice: '$0.50',
    currency: 'USD',
    sifaloHostedMethods: ['mobile_money'],
    sifaloCardSupported: false,
    sifaloMethodRuleNote:
      'Amount is $0.50 (50 cents <= 51 cents threshold in Sifalo checkout.js), so Sifalo displays Mobile Money.',
  },
  driverLicense: {
    productKey: 'driverLicense',
    label: 'Driver License',
    amountCents: 50,
    amountUsdString: '0.50',
    formattedPrice: '$0.50',
    currency: 'USD',
    sifaloHostedMethods: ['mobile_money'],
    sifaloCardSupported: false,
    sifaloMethodRuleNote:
      'Amount is $0.50 (50 cents <= 51 cents threshold in Sifalo checkout.js), so Sifalo displays Mobile Money.',
  },
  proofOfAddress: {
    productKey: 'proofOfAddress',
    label: 'Proof of Address',
    amountCents: 50,
    amountUsdString: '0.50',
    formattedPrice: '$0.50',
    currency: 'USD',
    sifaloHostedMethods: ['mobile_money'],
    sifaloCardSupported: false,
    sifaloMethodRuleNote:
      'Amount is $0.50 (50 cents <= 51 cents threshold in Sifalo checkout.js), so Sifalo displays Mobile Money.',
  },
  proofOfAccount: {
    productKey: 'proofOfAccount',
    label: 'Proof of Account',
    amountCents: 50,
    amountUsdString: '0.50',
    formattedPrice: '$0.50',
    currency: 'USD',
    sifaloHostedMethods: ['mobile_money'],
    sifaloCardSupported: false,
    sifaloMethodRuleNote:
      'Amount is $0.50 (50 cents <= 51 cents threshold in Sifalo checkout.js), so Sifalo displays Mobile Money.',
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
  sessionId?: string | null;
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
  sessionId?: string | null;
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
  sessionId?: string | null;
  amountCents?: number;
  currency?: 'USD';
  sid?: string | null;
  exp: number;
}

interface SignedGrantCookieEntry {
  o: string; // orderId
  t: string; // unlockTokenId
  sid: string; // verified providerSid
  p: UnlockProductKey; // productKey
  a: number; // amountCents
  e: number; // expiresAt
  c: number; // createdAt
  env: SifaloEnvironment;
}

interface SignedGrantsCookiePayload {
  s: string; // sessionId
  g: Partial<Record<UnlockProductKey, SignedGrantCookieEntry>>;
}

interface SignedPendingCheckoutCookiePayload {
  o: string; // orderId
  p: UnlockProductKey; // productKey
  ck: string; // countryKey
  pk: string; // providerKey
  s: string | null; // sessionId
  sid: string | null; // providerSid
  st: string; // orderStateToken
  c: number; // createdAt
}

const UNLOCK_GRANT_TTL_MS = 60 * 60 * 1000;
const ORDER_EXPIRY_TTL_MS = 60 * 60 * 1000;
const STALE_ORDER_PRUNE_MS = 24 * 60 * 60 * 1000;
const MAX_PROCESSED_WEBHOOK_EVENTS = 5000;
const SIFALO_SESSION_COOKIE_NAME = 'kyc_sifalo_sid';
const SIFALO_GRANTS_COOKIE_NAME = 'kyc_sifalo_grants';
const SIFALO_PENDING_COOKIE_NAME = 'kyc_sifalo_pending';

export const OFFICIAL_SIFALO_ENDPOINTS: Record<SifaloEnvironment, SifaloEndpointConfig> = {
  production: {
    environment: 'production',
    gatewayUrl: 'https://api.sifalopay.com/gateway/',
    verifyUrl: 'https://api.sifalopay.com/gateway/verify.php',
    hostedCheckoutBaseUrl: 'https://pay.sifalo.com/checkout/',
  },
  staging: {
    environment: 'staging',
    gatewayUrl: 'https://spay-api.sifalo.net/gateway/',
    verifyUrl: 'https://spay-api.sifalo.net/gateway/verify.php',
    hostedCheckoutBaseUrl: 'https://pay.sifalo.net/checkout/',
  },
};

export function resolveSifaloEndpoints(
  environment: SifaloEnvironment,
  _overrides: { gatewayUrl?: string; verifyUrl?: string; checkoutBaseUrl?: string } = {}
): SifaloEndpointConfig {
  const envKey: SifaloEnvironment = environment === 'staging' ? 'staging' : 'production';
  return { ...OFFICIAL_SIFALO_ENDPOINTS[envKey] };
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

function sanitizeEnvValue(rawVal: unknown): string {
  if (typeof rawVal !== 'string') return '';
  const cleaned = rawVal
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
  if (
    !cleaned ||
    /^\[.*\]$/.test(cleaned) ||
    /^<.*>$/.test(cleaned) ||
    /paste\s+my\s+(username|api\s*key)/i.test(cleaned)
  ) {
    return '';
  }
  return cleaned;
}

function getLiveProcessEnv(): Record<string, string | undefined> {
  try {
    const reflected = Reflect.get(globalThis.process || process, 'env');
    if (reflected && typeof reflected === 'object') {
      return reflected as Record<string, string | undefined>;
    }
  } catch {
    // Fallback to process.env
  }
  return process.env || {};
}

function readRuntimeEnv(
  key:
    | 'SIFALO_API_USER'
    | 'SIFALO_API_KEY'
    | 'SIFALO_WEBHOOK_SECRET'
    | 'SIFALO_ENV'
    | 'APP_BASE_URL'
    | 'SIFALO_API_BASE_URL'
    | 'SIFALO_VERIFY_URL'
    | 'SIFALO_CHECKOUT_URL'
    | 'SIFALO_DATA_DIR'
): string {
  let directVal: string | undefined;
  switch (key) {
    case 'SIFALO_API_USER':
      directVal = process.env.SIFALO_API_USER;
      break;
    case 'SIFALO_API_KEY':
      directVal = process.env.SIFALO_API_KEY;
      break;
    case 'SIFALO_WEBHOOK_SECRET':
      directVal = process.env.SIFALO_WEBHOOK_SECRET;
      break;
    case 'SIFALO_ENV':
      directVal = process.env.SIFALO_ENV;
      break;
    case 'APP_BASE_URL':
      directVal = process.env.APP_BASE_URL;
      break;
    case 'SIFALO_API_BASE_URL':
      directVal = process.env.SIFALO_API_BASE_URL;
      break;
    case 'SIFALO_VERIFY_URL':
      directVal = process.env.SIFALO_VERIFY_URL;
      break;
    case 'SIFALO_CHECKOUT_URL':
      directVal = process.env.SIFALO_CHECKOUT_URL;
      break;
    case 'SIFALO_DATA_DIR':
      directVal = process.env.SIFALO_DATA_DIR;
      break;
  }

  const cleanedDirect = sanitizeEnvValue(directVal);
  if (cleanedDirect) {
    return cleanedDirect;
  }

  const liveEnv = getLiveProcessEnv();
  const cleanedDynamic = sanitizeEnvValue(liveEnv[key]);
  if (cleanedDynamic) {
    return cleanedDynamic;
  }

  // Fallback scan in case the Vercel Dashboard key name has accidental leading/trailing whitespace or zero-width characters
  const targetNormalized = key.toUpperCase();
  for (const [rawK, rawV] of Object.entries(liveEnv)) {
    const normalizedK = rawK.replace(/[\s\u200B-\u200D\uFEFF]+/g, '').toUpperCase();
    if (normalizedK === targetNormalized) {
      const cleanedFallback = sanitizeEnvValue(rawV);
      if (cleanedFallback) {
        return cleanedFallback;
      }
    }
  }

  return '';
}

function resolveDefaultPersistencePath(customDir: string): string {
  if (customDir) {
    return path.resolve(customDir, 'sifalo-payments.json');
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'kycapproved-sifalo-payments.json');
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
      const raw = (readRuntimeEnv('SIFALO_ENV') || 'production').toLowerCase();
      return raw === 'staging' || raw === 'test' || raw === 'sandbox' ? 'staging' : 'production';
    });
  const getApiUser = deps.getApiUser ?? (() => readRuntimeEnv('SIFALO_API_USER'));
  const getApiKey = deps.getApiKey ?? (() => readRuntimeEnv('SIFALO_API_KEY'));
  const getWebhookSecret = deps.getWebhookSecret ?? (() => readRuntimeEnv('SIFALO_WEBHOOK_SECRET'));
  const getAppBaseUrl = deps.getAppBaseUrl ?? (() => readRuntimeEnv('APP_BASE_URL'));
  const getCustomGatewayUrl =
    deps.getCustomGatewayUrl ?? (() => readRuntimeEnv('SIFALO_API_BASE_URL'));
  const getCustomVerifyUrl =
    deps.getCustomVerifyUrl ?? (() => readRuntimeEnv('SIFALO_VERIFY_URL'));
  const getCustomCheckoutBaseUrl =
    deps.getCustomCheckoutBaseUrl ?? (() => readRuntimeEnv('SIFALO_CHECKOUT_URL'));
  const getPersistentDataDir =
    deps.getPersistentDataDir ?? (() => readRuntimeEnv('SIFALO_DATA_DIR'));

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

  let lastLoadedMtimeMs = -1;

  function loadPersistedState() {
    if (!resolvedPersistencePath) return;
    try {
      const stat = fs.statSync(resolvedPersistencePath);
      if (stat.mtimeMs === lastLoadedMtimeMs) return;
      const raw = fs.readFileSync(resolvedPersistencePath, 'utf8');
      lastLoadedMtimeMs = stat.mtimeMs;
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
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
        return;
      }
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
      try {
        lastLoadedMtimeMs = fs.statSync(resolvedPersistencePath).mtimeMs;
      } catch {
        // ignore stat errors
      }
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

  function sanitizeSessionId(rawVal: unknown): string | null {
    if (typeof rawVal !== 'string') return null;
    const cleaned = rawVal.trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 96);
    return cleaned || null;
  }

  function parseCookies(req: Request): Record<string, string> {
    const rawHeader = req.headers.cookie;
    const cookies: Record<string, string> = {};
    if (typeof rawHeader !== 'string' || !rawHeader.trim()) {
      return cookies;
    }
    const parts = rawHeader.split(';');
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx <= 0) continue;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(val);
        } catch {
          cookies[key] = val;
        }
      }
    }
    return cookies;
  }

  function isSecureCookieRequest(req: Request): boolean {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    return Boolean(req.secure || forwardedProto === 'https');
  }

  function appendSetCookie(res: Response, cookieString: string) {
    if (typeof res.append === 'function') {
      res.append('Set-Cookie', cookieString);
      return;
    }
    const existing = res.getHeader('Set-Cookie');
    if (!existing) {
      res.setHeader('Set-Cookie', cookieString);
    } else if (Array.isArray(existing)) {
      res.setHeader('Set-Cookie', [...existing, cookieString]);
    } else {
      res.setHeader('Set-Cookie', [String(existing), cookieString]);
    }
  }

  function signCookiePayload(purpose: string, data: unknown): string {
    const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(`ck:${purpose}:${encoded}`)
      .digest('base64url');
    return `${encoded}.${sig}`;
  }

  function verifyCookiePayload<T>(purpose: string, rawToken: string): T | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const parts = rawToken.trim().split('.');
    if (parts.length !== 2) return null;
    const [encoded, providedSig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(`ck:${purpose}:${encoded}`)
      .digest('base64url');
    if (!constantTimeStringEqual(providedSig, expectedSig)) {
      return null;
    }
    try {
      return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
    } catch {
      return null;
    }
  }

  function buildSessionCookieAttributes(req: Request, clear = false): string {
    const expirePart = clear ? '; Max-Age=0' : '';
    if (isSecureCookieRequest(req)) {
      return `; Path=/; HttpOnly; SameSite=None; Secure; Partitioned${expirePart}`;
    }
    return `; Path=/; HttpOnly; SameSite=Lax${expirePart}`;
  }

  function isUntrustedCrossOriginPost(req: Request): boolean {
    const rawOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    if (!rawOrigin) {
      return false;
    }
    let requestOrigin = '';
    try {
      requestOrigin = new URL(rawOrigin).origin;
    } catch {
      return true;
    }
    const allowedOrigins = new Set<string>();
    const reqOrigin = parseOriginBaseUrl(req, '');
    if (reqOrigin) allowedOrigins.add(reqOrigin);
    const configuredOrigin = parseOriginBaseUrl(req, getAppBaseUrl());
    if (configuredOrigin) allowedOrigins.add(configuredOrigin);
    if (allowedOrigins.size === 0) {
      return false;
    }
    return !allowedOrigins.has(requestOrigin);
  }

  function getVerifiedSessionFromCookie(req: Request): string | null {
    const cookies = parseCookies(req);
    const raw = cookies[SIFALO_SESSION_COOKIE_NAME];
    if (!raw) return null;
    const parsed = verifyCookiePayload<{ sid?: unknown }>('sid', raw);
    if (!parsed) return null;
    return sanitizeSessionId(parsed.sid);
  }

  function setSignedSessionCookie(req: Request, res: Response, sessionId: string) {
    const signed = signCookiePayload('sid', { sid: sessionId, iat: now() });
    appendSetCookie(
      res,
      `${SIFALO_SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}${buildSessionCookieAttributes(req)}`
    );
  }

  function getVerifiedGrantsFromCookie(
    req: Request,
    expectedSessionId: string | null
  ): Partial<Record<UnlockProductKey, SignedGrantCookieEntry>> {
    const cookies = parseCookies(req);
    const raw = cookies[SIFALO_GRANTS_COOKIE_NAME];
    if (!raw) return {};
    const parsed = verifyCookiePayload<SignedGrantsCookiePayload>('grants', raw);
    if (!parsed || typeof parsed.s !== 'string' || !parsed.g || typeof parsed.g !== 'object') {
      return {};
    }
    const cookieSession = sanitizeSessionId(parsed.s);
    if (!cookieSession) return {};
    if (expectedSessionId && cookieSession !== expectedSessionId) {
      return {};
    }
    const validGrants: Partial<Record<UnlockProductKey, SignedGrantCookieEntry>> = {};
    const currentNow = now();
    for (const [k, entry] of Object.entries(parsed.g)) {
      const pk = normalizeDocTypeToProductKey(k);
      if (!pk || !entry || typeof entry !== 'object') continue;
      if (
        typeof entry.o !== 'string' ||
        typeof entry.t !== 'string' ||
        typeof entry.sid !== 'string' ||
        entry.p !== pk ||
        typeof entry.e !== 'number' ||
        entry.e <= currentNow
      ) {
        continue;
      }
      const spec = AUTHORITATIVE_PRODUCT_PRICING[pk];
      if (entry.a !== spec.amountCents) continue;
      validGrants[pk] = {
        o: entry.o,
        t: entry.t,
        sid: entry.sid,
        p: pk,
        a: spec.amountCents,
        e: entry.e,
        c: typeof entry.c === 'number' ? entry.c : currentNow,
        env: entry.env === 'staging' ? 'staging' : 'production',
      };
    }
    return validGrants;
  }

  function setSignedGrantsCookie(
    req: Request,
    res: Response,
    sessionId: string,
    grantsMap: Partial<Record<UnlockProductKey, SignedGrantCookieEntry>>
  ) {
    const entries = Object.entries(grantsMap).filter(([, v]) => Boolean(v && v.e > now()));
    if (entries.length === 0) {
      appendSetCookie(
        res,
        `${SIFALO_GRANTS_COOKIE_NAME}=${buildSessionCookieAttributes(req, true)}`
      );
      return;
    }
    const cleanMap: Partial<Record<UnlockProductKey, SignedGrantCookieEntry>> = {};
    for (const [k, v] of entries) {
      if (v) cleanMap[k as UnlockProductKey] = v;
    }
    const signed = signCookiePayload('grants', { s: sessionId, g: cleanMap });
    appendSetCookie(
      res,
      `${SIFALO_GRANTS_COOKIE_NAME}=${encodeURIComponent(signed)}${buildSessionCookieAttributes(req)}`
    );
  }

  function getVerifiedPendingCheckoutFromCookie(
    req: Request,
    expectedSessionId: string | null
  ): SignedPendingCheckoutCookiePayload | null {
    const cookies = parseCookies(req);
    const raw = cookies[SIFALO_PENDING_COOKIE_NAME];
    if (!raw) return null;
    const parsed = verifyCookiePayload<SignedPendingCheckoutCookiePayload>('pending', raw);
    if (
      !parsed ||
      typeof parsed.o !== 'string' ||
      typeof parsed.p !== 'string' ||
      !AUTHORITATIVE_PRODUCT_PRICING[parsed.p as UnlockProductKey] ||
      typeof parsed.st !== 'string' ||
      typeof parsed.c !== 'number' ||
      now() - parsed.c > ORDER_EXPIRY_TTL_MS
    ) {
      return null;
    }
    const pendingSession = sanitizeSessionId(parsed.s);
    if (pendingSession && expectedSessionId && pendingSession !== expectedSessionId) {
      return null;
    }
    return {
      o: parsed.o,
      p: parsed.p,
      ck: sanitizeShortSlug(parsed.ck, 'global'),
      pk: sanitizeShortSlug(parsed.pk, 'paypal'),
      s: pendingSession,
      sid: typeof parsed.sid === 'string' && parsed.sid.trim() ? parsed.sid.trim() : null,
      st: parsed.st,
      c: parsed.c,
    };
  }

  function setSignedPendingCheckoutCookie(
    req: Request,
    res: Response,
    order: SifaloOrderRecord,
    orderStateToken: string
  ) {
    const payload: SignedPendingCheckoutCookiePayload = {
      o: order.orderId,
      p: order.productKey,
      ck: order.countryKey,
      pk: order.providerKey,
      s: order.sessionId || null,
      sid: order.providerSid || null,
      st: orderStateToken,
      c: order.createdAt,
    };
    const signed = signCookiePayload('pending', payload);
    appendSetCookie(
      res,
      `${SIFALO_PENDING_COOKIE_NAME}=${encodeURIComponent(signed)}${buildSessionCookieAttributes(req)}`
    );
  }

  function clearSignedPendingCheckoutCookie(req: Request, res: Response) {
    appendSetCookie(
      res,
      `${SIFALO_PENDING_COOKIE_NAME}=${buildSessionCookieAttributes(req, true)}`
    );
  }

  function buildGrantCookieEntry(order: SifaloOrderRecord): SignedGrantCookieEntry | null {
    if (
      order.status !== 'PAID' ||
      order.revokedAt ||
      !order.providerSid ||
      !order.unlockTokenId ||
      !order.unlockTokenExpiresAt ||
      order.unlockTokenExpiresAt <= now()
    ) {
      return null;
    }
    return {
      o: order.orderId,
      t: order.unlockTokenId,
      sid: order.providerSid,
      p: order.productKey,
      a: order.amountCents,
      e: order.unlockTokenExpiresAt,
      c: order.createdAt,
      env: order.environment,
    };
  }

  function resolveSessionBinding(
    req: Request,
    body?: Record<string, unknown> | null
  ): {
    cookieSessionId: string | null;
    clientSessionId: string | null;
    effectiveSessionId: string | null;
  } {
    const cookieSessionId = getVerifiedSessionFromCookie(req);
    const fromBody = body ? sanitizeSessionId(body.sessionId) : null;
    const fromHeader = sanitizeSessionId(req.headers['x-kyc-session-id']);
    const fromQuery = sanitizeSessionId(req.query.sessionId);
    const clientSessionId = fromBody || fromHeader || fromQuery || null;
    // Signed HttpOnly cookie is authoritative when present so redirects/refreshes cannot lose or spoof the session
    const effectiveSessionId = cookieSessionId || clientSessionId;
    return { cookieSessionId, clientSessionId, effectiveSessionId };
  }

  function extractRequestSessionId(
    req: Request,
    body?: Record<string, unknown> | null
  ): string | null {
    return resolveSessionBinding(req, body).effectiveSessionId;
  }

  function signOrderStateToken(order: SifaloOrderRecord): string {
    const payload: SignedOrderPayload = {
      orderId: order.orderId,
      productKey: order.productKey,
      countryKey: order.countryKey,
      providerKey: order.providerKey,
      sessionId: order.sessionId || null,
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
    // Strip any ?sid=... or &sid=... that Sifalo's redirect may have concatenated onto the end of order_state
    const cleanToken = token.split(/[?&]/)[0].trim();
    const parts = cleanToken.split('.');
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
      const cleanExpectedOrderId = expectedOrderId ? expectedOrderId.split(/[?&]/)[0].trim() : '';
      if (cleanExpectedOrderId && parsed.orderId !== cleanExpectedOrderId) {
        return null;
      }
      const priceSpec = AUTHORITATIVE_PRODUCT_PRICING[parsed.productKey];
      if (parsed.amountCents !== priceSpec.amountCents) {
        return null;
      }
      const existing = orders.get(parsed.orderId);
      if (existing) {
        if (existing.amountCents !== priceSpec.amountCents) {
          return null;
        }
        if (!existing.providerSid && parsed.providerSid) {
          existing.providerSid = parsed.providerSid;
          sidToOrderId.set(parsed.providerSid, existing.orderId);
        }
        if (!existing.sessionId && parsed.sessionId) {
          existing.sessionId = sanitizeSessionId(parsed.sessionId);
        }
        return existing;
      }
      const recovered: SifaloOrderRecord = {
        orderId: parsed.orderId,
        productKey: parsed.productKey,
        countryKey: sanitizeShortSlug(parsed.countryKey, 'global'),
        providerKey: sanitizeShortSlug(parsed.providerKey, 'virtual-account'),
        sessionId: sanitizeSessionId(parsed.sessionId),
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
      sessionId: order.sessionId || null,
      amountCents: order.amountCents,
      currency: order.currency,
      sid: order.providerSid || order.transactionRef || null,
      exp: order.unlockTokenExpiresAt,
    });
    return {
      unlockToken,
      expiresAt: order.unlockTokenExpiresAt,
    };
  }

  function formatSifaloCheckoutQueryValue(rawVal: string): string {
    let cleaned = rawVal.trim();
    if (!cleaned) return '';
    // If a value was accidentally double-encoded (e.g. %253D), unwrap %25XX -> %XX down to single encoding
    while (/%25[0-9A-Fa-f]{2}/.test(cleaned)) {
      try {
        const decodedOnce = decodeURIComponent(cleaned);
        if (decodedOnce === cleaned) break;
        cleaned = decodedOnce;
      } catch {
        break;
      }
    }
    // Sifalo Pay returns key and token already URL-encoded (e.g. containing %3D, %2B, %2F).
    // Do NOT run encodeURIComponent again on an already percent-encoded value or '%' will become '%25' (%253D).
    if (/%[0-9A-Fa-f]{2}/.test(cleaned)) {
      return cleaned;
    }
    // If Sifalo returned a raw unencoded value (no %XX sequences), encode it once.
    return encodeURIComponent(cleaned);
  }

  function extractRawQueryParamFromUrl(rawUrl: string, paramName: string): string {
    const qIdx = rawUrl.indexOf('?');
    if (qIdx === -1) return '';
    const hashIdx = rawUrl.indexOf('#', qIdx);
    const query = hashIdx === -1 ? rawUrl.slice(qIdx + 1) : rawUrl.slice(qIdx + 1, hashIdx);
    const prefix = `${paramName}=`;
    for (const part of query.split('&')) {
      if (part.startsWith(prefix)) {
        return part.slice(prefix.length).trim();
      }
    }
    return '';
  }

  function resolveHostedCheckoutUrl(
    sifaloData: Record<string, unknown>,
    endpoints: SifaloEndpointConfig
  ): string | null {
    const officialBase = endpoints.hostedCheckoutBaseUrl.replace(/\/+$/, '');
    let key = typeof sifaloData.key === 'string' ? sifaloData.key.trim() : '';
    let token = typeof sifaloData.token === 'string' ? sifaloData.token.trim() : '';

    if (!key || !token) {
      const directUrl = [sifaloData.checkout_url, sifaloData.payment_url, sifaloData.url]
        .find((u) => typeof u === 'string' && /^https?:\/\//i.test(u)) as string | undefined;
      if (directUrl) {
        try {
          const rawKey = extractRawQueryParamFromUrl(directUrl, 'key');
          const rawToken = extractRawQueryParamFromUrl(directUrl, 'token');
          const parsedDirect = new URL(directUrl);
          key = key || rawKey || (parsedDirect.searchParams.get('key') || '').trim();
          token = token || rawToken || (parsedDirect.searchParams.get('token') || '').trim();
        } catch {
          return null;
        }
      }
    }

    if (key && token) {
      const formattedKey = formatSifaloCheckoutQueryValue(key);
      const formattedToken = formatSifaloCheckoutQueryValue(token);
      if (!formattedKey || !formattedToken) return null;
      return `${officialBase}/?key=${formattedKey}&token=${formattedToken}`;
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
    overrideSid?: string,
    preserveGrant?: { tid: string; expiresAt: number }
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

    if (preserveGrant && preserveGrant.expiresAt <= now()) {
      return {
        ok: false,
        status: 'EXPIRED',
        error: 'Paid session has expired. Please start a new payment.',
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

    const sidToVerify = (overrideSid || order.providerSid || '').split(/[?&]/)[0].trim();
    const verifyBody: Record<string, string> = sidToVerify
      ? { sid: sidToVerify, order_id: order.orderId }
      : { order_id: order.orderId };

    const callVerifyEndpoint = async (payload: Record<string, string>) => {
      const response = await fetchImpl(endpoints.verifyUrl, {
        method: 'POST',
        headers: {
          Authorization: buildBasicAuthHeader(apiUser, apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      return { response, json };
    };

    let res: globalThis.Response;
    let data: Record<string, unknown> | null = null;
    try {
      const firstAttempt = await callVerifyEndpoint(verifyBody);
      res = firstAttempt.response;
      data = firstAttempt.json;

      // Hosted checkout (`gateway: "checkout"`) transactions in Sifalo's verify.php can return
      // "order_id not found" when both sid and order_id are passed; fallback to querying by sid alone.
      if (
        sidToVerify &&
        res.ok &&
        data &&
        !isSifaloSuccessPayload(data) &&
        typeof data.response === 'string' &&
        data.response.toLowerCase().includes('order_id not found')
      ) {
        const secondAttempt = await callVerifyEndpoint({ sid: sidToVerify });
        if (secondAttempt.response.ok && secondAttempt.json) {
          res = secondAttempt.response;
          data = secondAttempt.json;
        }
      }
    } catch {
      return {
        ok: false,
        status: order.status,
        isPending: order.status === 'PENDING',
        error: 'Could not reach Sifalo Pay verification gateway.',
      };
    }

    if (!res.ok || !data) {
      return {
        ok: false,
        status: order.status,
        isPending: order.status === 'PENDING',
        error: 'Invalid verification response from Sifalo Pay.',
      };
    }

    const rawProviderResponseText =
      typeof data.response === 'string' ? data.response.trim().toLowerCase() : '';
    const isUnpaidCheckoutNotYetRecorded =
      !isSifaloSuccessPayload(data) &&
      !sidToVerify &&
      rawProviderResponseText.includes('order_id not found');

    if (isUnpaidCheckoutNotYetRecorded) {
      return {
        ok: false,
        status: order.status,
        isPending: order.status === 'PENDING',
        error:
          'Payment has not been completed or confirmed by Sifalo Pay. Save PNG & Download remain locked.',
        data,
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
            ? 'Payment is still awaiting confirmation from Sifalo Pay. Save PNG & Download remain locked.'
            : `Payment ${nonSuccess.toLowerCase()}. Save PNG & Download remain locked.`,
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

    // Require explicit USD currency in verified Sifalo payload
    const returnedCurrency =
      typeof data.currency === 'string' && data.currency.trim()
        ? data.currency.trim().toUpperCase()
        : '';
    if (returnedCurrency !== order.currency) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo payment currency mismatch (USD required).',
      };
    }

    const expectedPriceSpec = AUTHORITATIVE_PRODUCT_PRICING[order.productKey];
    const paidCents = parseAmountToCents(data.amount);
    if (
      !expectedPriceSpec ||
      paidCents !== expectedPriceSpec.amountCents ||
      paidCents !== order.amountCents
    ) {
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

    if (!verifiedSid) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo payment response is missing a valid transaction SID.',
      };
    }

    if (order.providerSid && order.providerSid !== verifiedSid) {
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo transaction SID does not match order SID.',
      };
    }

    const existingOwner = consumedTransactions.get(verifiedSid);
    if (existingOwner && existingOwner !== order.orderId) {
      return {
        ok: false,
        status: order.status,
        error: 'This Sifalo checkout transaction has already been used for another order.',
      };
    }
    consumedTransactions.set(verifiedSid, order.orderId);
    sidToOrderId.set(verifiedSid, order.orderId);
    order.providerSid = verifiedSid;
    order.transactionRef = verifiedSid;

    // Bind & atomically transition PENDING -> PAID
    if (order.status !== 'PAID') {
      const paidAt = now();
      order.status = 'PAID';
      order.paidAt = paidAt;
      order.revokedAt = null;
      if (preserveGrant && preserveGrant.tid && preserveGrant.expiresAt > paidAt) {
        order.unlockTokenId = preserveGrant.tid;
        order.unlockTokenExpiresAt = preserveGrant.expiresAt;
      } else {
        order.unlockTokenId = crypto.randomUUID();
        order.unlockTokenExpiresAt = paidAt + UNLOCK_GRANT_TTL_MS;
      }
      orders.set(order.orderId, order);
      persistState();
      console.info(
        `[Sifalo] Order verified PAID: orderId=${order.orderId} sid=${verifiedSid} product=${order.productKey} amount=$${order.amountUsdString}`
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

      const expectedPriceSpec = AUTHORITATIVE_PRODUCT_PRICING[order.productKey];
      const incomingCents = parseAmountToCents(body.amount);
      if (
        !expectedPriceSpec ||
        incomingCents !== expectedPriceSpec.amountCents ||
        incomingCents !== order.amountCents
      ) {
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

  function getDiagnostics() {
    const apiUserPresent = Boolean(getApiUser());
    const apiKeyPresent = Boolean(getApiKey());
    const webhookSecretPresent = Boolean(getWebhookSecret());
    const appBaseUrlPresent = Boolean(getAppBaseUrl());
    const environment = getEnvironment();
    const endpoints = resolveSifaloEndpoints(environment);
    const checkoutHostname = new URL(endpoints.hostedCheckoutBaseUrl).hostname;
    const gatewayHostname = new URL(endpoints.gatewayUrl).hostname;
    const liveEnv = getLiveProcessEnv();
    const detectedSifaloEnvKeys = Object.keys(liveEnv)
      .filter((k) => /SIFALO|APP_BASE/i.test(k))
      .map((k) => k.trim())
      .sort();

    return {
      SIFALO_API_USER_PRESENT: apiUserPresent,
      SIFALO_API_KEY_PRESENT: apiKeyPresent,
      SIFALO_WEBHOOK_SECRET_PRESENT: webhookSecretPresent,
      SIFALO_ENV: environment,
      APP_BASE_URL_PRESENT: appBaseUrlPresent,
      VERCEL: Boolean(liveEnv.VERCEL),
      VERCEL_ENV: liveEnv.VERCEL_ENV || null,
      checkoutHostname,
      gatewayHostname,
      hostedCheckoutBaseUrl: endpoints.hostedCheckoutBaseUrl,
      gatewayUrl: endpoints.gatewayUrl,
      detectedSifaloEnvKeys,
    };
  }

  function createRouter() {
    const router = express.Router();

    router.get('/config', (_req: Request, res: Response) => {
      const environment = getEnvironment();
      const diagnostics = getDiagnostics();
      const configured = diagnostics.SIFALO_API_USER_PRESENT && diagnostics.SIFALO_API_KEY_PRESENT;
      return res.json({
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
        provider: 'sifalo',
        environment,
        checkoutHostname: diagnostics.checkoutHostname,
        gatewayHostname: diagnostics.gatewayHostname,
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

    router.get('/diagnostics', (_req: Request, res: Response) => {
      const diagnostics = getDiagnostics();
      const configured = diagnostics.SIFALO_API_USER_PRESENT && diagnostics.SIFALO_API_KEY_PRESENT;
      return res.json({
        configured,
        diagnostics,
      });
    });

    router.post('/create-checkout', async (req: Request, res: Response) => {
      try {
        if (isUntrustedCrossOriginPost(req)) {
          return res.status(403).json({ error: 'Cross-origin checkout request rejected.' });
        }
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
          const diagnostics = getDiagnostics();
          return res.status(503).json({
            code: 'PAYMENT_NOT_CONFIGURED',
            configured: false,
            diagnostics: {
              SIFALO_API_USER_PRESENT: diagnostics.SIFALO_API_USER_PRESENT,
              SIFALO_API_KEY_PRESENT: diagnostics.SIFALO_API_KEY_PRESENT,
              VERCEL_ENV: diagnostics.VERCEL_ENV,
            },
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
        const sessionBinding = resolveSessionBinding(req, body);
        const sessionId =
          sessionBinding.effectiveSessionId || `kycsess_${crypto.randomUUID().replace(/-/g, '')}`;
        if (!sessionBinding.cookieSessionId || sessionBinding.cookieSessionId !== sessionId) {
          setSignedSessionCookie(req, res, sessionId);
        }

        // Invalidate any previous unconfirmed PENDING orders for this session and product so every click starts a fresh Sifalo checkout session
        for (const existingOrd of orders.values()) {
          if (
            existingOrd.sessionId === sessionId &&
            existingOrd.productKey === productKey &&
            existingOrd.status === 'PENDING'
          ) {
            existingOrd.status = 'CANCELLED';
            orders.set(existingOrd.orderId, existingOrd);
          }
        }

        let orderId = `KYC-${crypto.randomUUID()}`;
        while (orders.has(orderId)) {
          orderId = `KYC-${crypto.randomUUID()}`;
        }
        const webhookAuthToken = computeOrderWebhookToken(orderId);

        const order: SifaloOrderRecord = {
          orderId,
          productKey,
          countryKey,
          providerKey,
          sessionId,
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

        const requestInit: RequestInit = {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: buildBasicAuthHeader(apiUser, apiKey),
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Cache-Control': 'no-store, no-cache',
            'User-Agent': 'KycApproved-SifaloPay/1.0',
          },
          body: JSON.stringify(sifaloRequestPayload),
        };

        let sifaloRes: globalThis.Response;
        try {
          sifaloRes = await fetchImpl(endpoints.gatewayUrl, requestInit);
        } catch (firstFetchErr) {
          try {
            // Single immediate retry on transient network/DNS socket error
            sifaloRes = await fetchImpl(endpoints.gatewayUrl, requestInit);
          } catch (retryErr) {
            orders.delete(orderId);
            const reason = retryErr instanceof Error ? retryErr.message : String(firstFetchErr);
            console.warn(`[Sifalo] Could not reach Sifalo gateway (${endpoints.gatewayUrl}): ${reason}`);
            return res.status(502).json({
              error: 'Could not connect to Sifalo Pay gateway. Please check your connection and try again.',
            });
          }
        }

        const sifaloJson = (await sifaloRes.json().catch(() => null)) as Record<string, unknown> | null;
        const keyReturned = Boolean(
          sifaloJson && typeof sifaloJson.key === 'string' && sifaloJson.key.trim().length > 0
        );
        const tokenReturned = Boolean(
          sifaloJson && typeof sifaloJson.token === 'string' && sifaloJson.token.trim().length > 0
        );
        const checkoutUrl = sifaloJson ? resolveHostedCheckoutUrl(sifaloJson, endpoints) : null;
        const configuredCheckoutHostname = new URL(endpoints.hostedCheckoutBaseUrl).hostname;

        if (!sifaloRes.ok || !sifaloJson || !checkoutUrl) {
          orders.delete(orderId);
          const providerMessage =
            (sifaloJson && typeof sifaloJson.response === 'string' && sifaloJson.response) ||
            (sifaloJson && typeof sifaloJson.message === 'string' && sifaloJson.message) ||
            'Unable to create Sifalo Pay hosted checkout session.';
          console.warn(
            `[Sifalo] Checkout creation failed: orderId=${orderId} product=${productKey} amount=$${priceSpec.amountUsdString} checkoutHost=${configuredCheckoutHostname} keyReturned=${keyReturned} tokenReturned=${tokenReturned} status=${sifaloRes.status}`
          );
          return res.status(502).json({ error: providerMessage });
        }

        const sid = typeof sifaloJson.sid === 'string' ? sifaloJson.sid.trim() : null;
        if (sid) {
          order.providerSid = sid;
          sidToOrderId.set(sid, orderId);
        }
        // Never persist or reuse Sifalo checkout key/token
        order.providerToken = null;
        orders.set(orderId, order);
        persistState();

        const orderStateToken = signOrderStateToken(order);
        setSignedPendingCheckoutCookie(req, res, order, orderStateToken);

        const checkoutHostname = new URL(checkoutUrl).hostname;

        console.info(
          `[Sifalo] Checkout created: orderId=${orderId} product=${productKey} amount=$${priceSpec.amountUsdString} checkoutHost=${checkoutHostname} keyReturned=${keyReturned} tokenReturned=${tokenReturned}`
        );

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.status(200).json({
          orderId: order.orderId,
          orderStateToken,
          checkoutUrl,
          checkoutHostname,
          environment,
          productKey: order.productKey,
          label: priceSpec.label,
          amount: priceSpec.amountUsdString,
          amountCents: order.amountCents,
          currency: order.currency,
          formattedPrice: priceSpec.formattedPrice,
          sessionId: order.sessionId || null,
          sifaloHostedMethods: priceSpec.sifaloHostedMethods,
          sifaloCardSupported: priceSpec.sifaloCardSupported,
          sifaloMethodRuleNote: priceSpec.sifaloMethodRuleNote,
          checkoutRequestSpec: {
            order_id: sifaloRequestPayload.order_id,
            amount: sifaloRequestPayload.amount,
            currency: sifaloRequestPayload.currency,
            gateway: sifaloRequestPayload.gateway,
            channel: sifaloRequestPayload.channel,
          },
        });
      } catch (err) {
        console.error('[Sifalo] Create checkout unexpected error:', err instanceof Error ? err.message : err);
        return res.status(500).json({ error: 'Failed to initiate Sifalo Pay checkout.' });
      }
    });

    router.post('/webhook', handleWebhook);

    router.post('/verify-order', async (req: Request, res: Response) => {
      try {
        if (isUntrustedCrossOriginPost(req)) {
          return res.status(403).json({ verified: false, error: 'Cross-origin verification request rejected.' });
        }
        loadPersistedState();
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const binding = resolveSessionBinding(req, body);
        const requestSessionId = binding.effectiveSessionId;
        const pendingCookie = getVerifiedPendingCheckoutFromCookie(req, requestSessionId);

        const rawOrderId = (typeof body.orderId === 'string' ? body.orderId : '').split(/[?&]/)[0].trim();
        const orderId = rawOrderId || (pendingCookie ? pendingCookie.o : '');
        const rawSid = (typeof body.sid === 'string' ? body.sid : '').split(/[?&]/)[0].trim();
        const sid = rawSid || (pendingCookie && pendingCookie.sid ? pendingCookie.sid : '');
        const rawOrderStateToken = (typeof body.orderStateToken === 'string' ? body.orderStateToken : '')
          .split(/[?&]/)[0]
          .trim();
        const orderStateToken = rawOrderStateToken || (pendingCookie ? pendingCookie.st : '');
        const returnStatus =
          typeof body.returnStatus === 'string' ? body.returnStatus.trim().toLowerCase() : '';
        const returnMessage =
          typeof body.returnMessage === 'string' ? body.returnMessage.trim().slice(0, 240) : '';

        if (!orderId) {
          return res.status(400).json({ verified: false, error: 'Missing orderId.' });
        }

        const order =
          orders.get(orderId) ||
          recoverOrderFromStateToken(orderStateToken, orderId) ||
          (pendingCookie ? recoverOrderFromStateToken(pendingCookie.st, orderId) : null);
        if (!order) {
          return res.status(404).json({ verified: false, error: 'Payment order not found.' });
        }

        const priceSpec = AUTHORITATIVE_PRODUCT_PRICING[order.productKey];

        // Enforce user/session binding when order was created with a session ID
        if (order.sessionId && order.sessionId !== requestSessionId) {
          return res.status(403).json({
            verified: false,
            status: order.status,
            orderId: order.orderId,
            productKey: order.productKey,
            label: priceSpec.label,
            formattedPrice: priceSpec.formattedPrice,
            error: 'Payment order belongs to a different user session.',
          });
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
          clearSignedPendingCheckoutCookie(req, res);
          return res.status(402).json({
            verified: false,
            status: order.status,
            productKey: order.productKey,
            orderId: order.orderId,
            label: priceSpec.label,
            formattedPrice: priceSpec.formattedPrice,
            error: `Payment ${order.status.toLowerCase()}. Save PNG & Download remain locked. Please start a new payment.`,
          });
        }

        // Always confirm server-to-server with Sifalo Verify API if not already verified PAID
        if (order.status === 'PENDING') {
          const check = await verifyTransactionWithSifaloApi(order, sid || undefined);
          if (!check.ok) {
            let effectiveStatus: OrderStatus = check.status;
            let effectiveError =
              check.error || 'Payment not confirmed by Sifalo Pay yet. Save PNG & Download remain locked.';

            if (effectiveStatus === 'PENDING') {
              if (returnStatus === 'cancelled' || returnStatus === 'canceled') {
                effectiveStatus = 'CANCELLED';
                order.status = 'CANCELLED';
                orders.set(order.orderId, order);
                persistState();
                clearSignedPendingCheckoutCookie(req, res);
                effectiveError =
                  'Payment was cancelled before confirmation. Save PNG & Download remain locked.';
              } else if (returnStatus === 'failed' || returnStatus === 'error') {
                effectiveStatus = 'FAILED';
                order.status = 'FAILED';
                orders.set(order.orderId, order);
                persistState();
                clearSignedPendingCheckoutCookie(req, res);
                effectiveError = returnMessage
                  ? `Payment failed (${returnMessage}). Save PNG & Download remain locked.`
                  : 'Payment failed on Sifalo checkout. Save PNG & Download remain locked.';
              }
            } else {
              clearSignedPendingCheckoutCookie(req, res);
            }

            const httpCode = check.isPending && effectiveStatus === 'PENDING' ? 202 : 402;
            return res.status(httpCode).json({
              verified: false,
              status: effectiveStatus,
              orderId: order.orderId,
              productKey: order.productKey,
              label: priceSpec.label,
              formattedPrice: priceSpec.formattedPrice,
              error: effectiveError,
            });
          }
        }

        if (order.status !== 'PAID' || !order.providerSid) {
          return res.status(402).json({
            verified: false,
            status: order.status,
            orderId: order.orderId,
            productKey: order.productKey,
            label: priceSpec.label,
            formattedPrice: priceSpec.formattedPrice,
            error: 'Payment has not been verified with a valid Sifalo transaction ID.',
          });
        }

        const grant = issueOrderUnlockGrant(order);
        if (!grant) {
          clearSignedPendingCheckoutCookie(req, res);
          return res.status(403).json({
            verified: false,
            status: 'EXPIRED',
            orderId: order.orderId,
            productKey: order.productKey,
            label: priceSpec.label,
            formattedPrice: priceSpec.formattedPrice,
            error: 'Paid session has expired. Please start a new payment.',
          });
        }

        clearSignedPendingCheckoutCookie(req, res);
        const activeSessionId = sessionBindingEffective(
          req,
          body,
          order.sessionId || `kycsess_${crypto.randomUUID().replace(/-/g, '')}`
        );
        if (!order.sessionId) {
          order.sessionId = activeSessionId;
          orders.set(order.orderId, order);
          persistState();
        }
        setSignedSessionCookie(req, res, activeSessionId);
        const cookieGrants = getVerifiedGrantsFromCookie(req, activeSessionId);
        const grantEntry = buildGrantCookieEntry(order);
        if (grantEntry) {
          cookieGrants[order.productKey] = grantEntry;
          setSignedGrantsCookie(req, res, activeSessionId, cookieGrants);
        }

        return res.status(200).json({
          verified: true,
          status: 'PAID',
          orderId: order.orderId,
          orderStateToken: signOrderStateToken(order),
          sid: order.providerSid,
          productKey: order.productKey,
          countryKey: order.countryKey,
          providerKey: order.providerKey,
          sessionId: activeSessionId,
          label: priceSpec.label,
          amount: priceSpec.amountUsdString,
          amountCents: order.amountCents,
          currency: order.currency,
          formattedPrice: priceSpec.formattedPrice,
          unlockToken: grant.unlockToken,
          expiresAt: grant.expiresAt,
        });
      } catch (err) {
        console.error('[Sifalo] Verify order error:', err instanceof Error ? err.message : err);
        return res.status(500).json({ verified: false, error: 'Failed to verify Sifalo payment.' });
      }
    });

    function sessionBindingEffective(
      req: Request,
      body: Record<string, unknown>,
      fallbackSessionId: string
    ): string {
      return resolveSessionBinding(req, body).effectiveSessionId || fallbackSessionId;
    }

    async function authorizeUnlockCandidate(params: {
      requestedProductKey: UnlockProductKey;
      unlockToken?: string;
      cookieGrantEntry?: SignedGrantCookieEntry;
      requestSessionId: string | null;
    }): Promise<
      | {
          authorized: true;
          orderId: string;
          sid: string;
          productKey: UnlockProductKey;
          label: string;
          formattedPrice: string;
          expiresAt: number;
          unlockToken: string;
          cookieEntry: SignedGrantCookieEntry;
        }
      | {
          authorized: false;
          httpStatus: number;
          error: string;
          clearGrant?: boolean;
        }
    > {
      const { requestedProductKey, unlockToken, cookieGrantEntry, requestSessionId } = params;
      const expectedSpec = AUTHORITATIVE_PRODUCT_PRICING[requestedProductKey];

      let payload: UnlockTokenPayload | null = null;
      let candidateEnv: SifaloEnvironment = getEnvironment();
      let candidateCreatedAt = now();

      if (unlockToken) {
        payload = verifyUnlockTokenString(unlockToken);
        if (!payload) {
          return {
            authorized: false,
            httpStatus: 401,
            error: 'Invalid or expired payment authorization token.',
            clearGrant: true,
          };
        }
      } else if (cookieGrantEntry) {
        if (cookieGrantEntry.e <= now()) {
          return {
            authorized: false,
            httpStatus: 401,
            error: 'Payment authorization has expired.',
            clearGrant: true,
          };
        }
        payload = {
          tid: cookieGrantEntry.t,
          orderId: cookieGrantEntry.o,
          productKey: cookieGrantEntry.p,
          sessionId: requestSessionId,
          amountCents: cookieGrantEntry.a,
          currency: 'USD',
          sid: cookieGrantEntry.sid,
          exp: cookieGrantEntry.e,
        };
        candidateEnv = cookieGrantEntry.env;
        candidateCreatedAt = cookieGrantEntry.c;
      } else {
        return {
          authorized: false,
          httpStatus: 401,
          error: 'Missing payment authorization token.',
        };
      }

      if (payload.productKey !== requestedProductKey) {
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization is not valid for this document category.',
        };
      }

      if (payload.sessionId && payload.sessionId !== requestSessionId) {
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization belongs to a different user session.',
        };
      }

      if (payload.amountCents !== undefined && payload.amountCents !== expectedSpec.amountCents) {
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization amount does not match document requirement.',
          clearGrant: true,
        };
      }

      if (payload.currency !== undefined && payload.currency !== 'USD') {
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization currency mismatch.',
          clearGrant: true,
        };
      }

      let order = orders.get(payload.orderId);

      // Explicitly reject revoked / refunded / reversed / cancelled / failed / expired orders
      if (
        order &&
        (order.revokedAt ||
          order.status === 'REFUNDED' ||
          order.status === 'REVERSED' ||
          order.status === 'CANCELLED' ||
          order.status === 'EXPIRED' ||
          order.status === 'FAILED')
      ) {
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Paid order verification is no longer active.',
          clearGrant: true,
        };
      }

      // Serverless / cold-start / cross-instance recovery:
      // If this server instance lacks the PAID record (or still holds PENDING from checkout creation
      // before another instance processed verify-order/webhook), re-verify directly against Sifalo's API.
      if (!order || order.status === 'PENDING') {
        const sidToCheck = typeof payload.sid === 'string' ? payload.sid.trim() : '';
        if (!sidToCheck) {
          return {
            authorized: false,
            httpStatus: 403,
            error: 'Paid order record not found on server.',
            clearGrant: true,
          };
        }

        if (order && order.sessionId && order.sessionId !== requestSessionId) {
          return {
            authorized: false,
            httpStatus: 403,
            error: 'Payment authorization belongs to a different user session.',
          };
        }

        const candidateOrder: SifaloOrderRecord = order ?? {
          orderId: payload.orderId,
          productKey: requestedProductKey,
          countryKey: 'global',
          providerKey: 'virtual-account',
          sessionId: payload.sessionId ?? requestSessionId ?? null,
          amountCents: expectedSpec.amountCents,
          amountUsdString: expectedSpec.amountUsdString,
          currency: 'USD',
          environment: candidateEnv,
          status: 'PENDING',
          providerSid: sidToCheck,
          providerToken: null,
          transactionRef: null,
          webhookAuthToken: computeOrderWebhookToken(payload.orderId),
          createdAt: candidateCreatedAt,
          paidAt: null,
          revokedAt: null,
          unlockTokenId: null,
          unlockTokenExpiresAt: null,
        };

        const check = await verifyTransactionWithSifaloApi(candidateOrder, sidToCheck, {
          tid: payload.tid,
          expiresAt: payload.exp,
        });
        if (!check.ok || candidateOrder.status !== 'PAID') {
          return {
            authorized: false,
            httpStatus: 403,
            error: check.error || 'Paid order record could not be confirmed with Sifalo Pay.',
            clearGrant: true,
          };
        }
        order = candidateOrder;
      }

      if (
        order.status !== 'PAID' ||
        order.revokedAt ||
        !order.providerSid ||
        order.productKey !== payload.productKey ||
        order.amountCents !== expectedSpec.amountCents ||
        order.currency !== 'USD' ||
        order.unlockTokenId !== payload.tid ||
        !order.unlockTokenExpiresAt ||
        order.unlockTokenExpiresAt <= now() ||
        (order.sessionId && order.sessionId !== requestSessionId)
      ) {
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Paid order verification is no longer active.',
          clearGrant: true,
        };
      }

      const freshGrant = issueOrderUnlockGrant(order);
      const cookieEntry = buildGrantCookieEntry(order);
      if (!freshGrant || !cookieEntry) {
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Paid order verification is no longer active.',
          clearGrant: true,
        };
      }

      return {
        authorized: true,
        orderId: order.orderId,
        sid: order.providerSid,
        productKey: order.productKey,
        label: expectedSpec.label,
        formattedPrice: expectedSpec.formattedPrice,
        expiresAt: freshGrant.expiresAt,
        unlockToken: freshGrant.unlockToken,
        cookieEntry,
      };
    }

    router.get('/order-status', (req: Request, res: Response) => {
      loadPersistedState();
      const orderId = (typeof req.query.orderId === 'string' ? req.query.orderId : '')
        .split(/[?&]/)[0]
        .trim();
      const orderStateToken = (
        typeof req.query.orderStateToken === 'string' ? req.query.orderStateToken : ''
      )
        .split(/[?&]/)[0]
        .trim();
      const requestSessionId = extractRequestSessionId(req, null);
      const order = orderId
        ? orders.get(orderId) || recoverOrderFromStateToken(orderStateToken, orderId)
        : null;
      if (!order) {
        return res.status(404).json({ error: 'Order not found.' });
      }
      if (order.sessionId && requestSessionId && order.sessionId !== requestSessionId) {
        return res.status(403).json({ error: 'Order belongs to a different user session.' });
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
        verified: order.status === 'PAID' && Boolean(order.providerSid),
      });
    });

    async function tryConfirmPendingOrderForProduct(
      req: Request,
      res: Response,
      sessionId: string,
      productKey: UnlockProductKey
    ): Promise<SignedGrantCookieEntry | undefined> {
      const pendingCookie = getVerifiedPendingCheckoutFromCookie(req, sessionId);
      let pendingOrder: SifaloOrderRecord | null = null;
      let pendingSid: string | undefined;

      if (pendingCookie && pendingCookie.p === productKey) {
        pendingOrder =
          orders.get(pendingCookie.o) ||
          recoverOrderFromStateToken(pendingCookie.st, pendingCookie.o);
        pendingSid = pendingCookie.sid || undefined;
      }

      if (!pendingOrder) {
        let newestPending: SifaloOrderRecord | null = null;
        for (const ord of orders.values()) {
          if (
            ord.productKey === productKey &&
            ord.sessionId === sessionId &&
            ord.status === 'PENDING' &&
            now() - ord.createdAt <= ORDER_EXPIRY_TTL_MS &&
            ord.providerSid
          ) {
            if (!newestPending || ord.createdAt > newestPending.createdAt) {
              newestPending = ord;
            }
          }
        }
        pendingOrder = newestPending;
        pendingSid = newestPending?.providerSid || undefined;
      }

      if (!pendingOrder) return undefined;

      if (pendingOrder.status === 'PAID') {
        if (pendingCookie && pendingCookie.o === pendingOrder.orderId) {
          clearSignedPendingCheckoutCookie(req, res);
        }
        return buildGrantCookieEntry(pendingOrder) || undefined;
      }

      if (pendingOrder.status !== 'PENDING' || (!pendingOrder.providerSid && !pendingSid)) {
        return undefined;
      }

      const check = await verifyTransactionWithSifaloApi(pendingOrder, pendingSid);
      if (check.ok && check.status === 'PAID') {
        if (pendingCookie && pendingCookie.o === pendingOrder.orderId) {
          clearSignedPendingCheckoutCookie(req, res);
        }
        return buildGrantCookieEntry(pendingOrder) || undefined;
      }

      if (
        check.status === 'FAILED' ||
        check.status === 'CANCELLED' ||
        check.status === 'EXPIRED' ||
        check.status === 'REFUNDED' ||
        check.status === 'REVERSED'
      ) {
        if (pendingCookie && pendingCookie.o === pendingOrder.orderId) {
          clearSignedPendingCheckoutCookie(req, res);
        }
      }
      return undefined;
    }

    function findLatestActiveOrderGrantEntry(
      sessionId: string | null,
      productKey: UnlockProductKey
    ): SignedGrantCookieEntry | undefined {
      if (!sessionId) return undefined;
      let latestEntry: SignedGrantCookieEntry | undefined;
      for (const ord of orders.values()) {
        if (
          ord.productKey === productKey &&
          ord.sessionId === sessionId &&
          ord.status === 'PAID' &&
          !ord.revokedAt &&
          ord.unlockTokenExpiresAt &&
          ord.unlockTokenExpiresAt > now()
        ) {
          const entry = buildGrantCookieEntry(ord);
          if (entry && (!latestEntry || entry.e > latestEntry.e)) {
            latestEntry = entry;
          }
        }
      }
      return latestEntry;
    }

    async function handleSessionStatus(req: Request, res: Response) {
      try {
        if (req.method === 'POST' && isUntrustedCrossOriginPost(req)) {
          return res.status(403).json({ authenticatedSession: false, unlockedProducts: {} });
        }
        loadPersistedState();
        const body =
          req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const binding = resolveSessionBinding(req, body);
        const sessionId =
          binding.effectiveSessionId || `kycsess_${crypto.randomUUID().replace(/-/g, '')}`;
        if (!binding.cookieSessionId || binding.cookieSessionId !== sessionId) {
          setSignedSessionCookie(req, res, sessionId);
        }

        const cookieGrants = getVerifiedGrantsFromCookie(req, sessionId);
        const rawCandidateGrants =
          body.candidateGrants && typeof body.candidateGrants === 'object'
            ? (body.candidateGrants as Record<string, unknown>)
            : {};

        const unlockedProducts: Partial<
          Record<
            UnlockProductKey,
            {
              authorized: true;
              productKey: UnlockProductKey;
              label: string;
              formattedPrice: string;
              orderId: string;
              sid: string;
              expiresAt: number;
              unlockToken: string;
            }
          >
        > = {};
        const nextCookieGrants: Partial<Record<UnlockProductKey, SignedGrantCookieEntry>> = {};

        const allProductKeys = Object.keys(AUTHORITATIVE_PRODUCT_PRICING) as UnlockProductKey[];
        for (const productKey of allProductKeys) {
          let candidateToken = '';
          const rawCandidate = rawCandidateGrants[productKey];
          if (rawCandidate && typeof rawCandidate === 'object') {
            const tok = (rawCandidate as Record<string, unknown>).unlockToken;
            if (typeof tok === 'string') {
              candidateToken = tok.trim();
            }
          }

          let cookieEntry =
            cookieGrants[productKey] || findLatestActiveOrderGrantEntry(sessionId, productKey);

          // If user paid at Sifalo and returned without query params, check pending checkout against Sifalo Verify API
          if (!cookieEntry) {
            cookieEntry = await tryConfirmPendingOrderForProduct(req, res, sessionId, productKey);
          }

          if (!candidateToken && !cookieEntry) {
            continue;
          }

          let auth = await authorizeUnlockCandidate({
            requestedProductKey: productKey,
            unlockToken: candidateToken || undefined,
            cookieGrantEntry: cookieEntry,
            requestSessionId: sessionId,
          });

          // If client passed an outdated candidateToken while valid server cookie/order exists, validate cookieEntry directly
          if (!auth.authorized && candidateToken && cookieEntry) {
            auth = await authorizeUnlockCandidate({
              requestedProductKey: productKey,
              cookieGrantEntry: cookieEntry,
              requestSessionId: sessionId,
            });
          }

          if (auth.authorized) {
            unlockedProducts[productKey] = {
              authorized: true,
              productKey: auth.productKey,
              label: auth.label,
              formattedPrice: auth.formattedPrice,
              orderId: auth.orderId,
              sid: auth.sid,
              expiresAt: auth.expiresAt,
              unlockToken: auth.unlockToken,
            };
            nextCookieGrants[productKey] = auth.cookieEntry;
          }
        }

        setSignedGrantsCookie(req, res, sessionId, nextCookieGrants);

        return res.status(200).json({
          authenticatedSession: true,
          sessionId,
          unlockedProducts,
        });
      } catch (err) {
        console.error('[Sifalo] Session status error:', err instanceof Error ? err.message : err);
        return res.status(500).json({ authenticatedSession: false, unlockedProducts: {} });
      }
    }

    router.get('/session-status', handleSessionStatus);
    router.post('/session-status', handleSessionStatus);

    router.post('/authorize-unlock', async (req: Request, res: Response) => {
      try {
        if (isUntrustedCrossOriginPost(req)) {
          return res.status(403).json({ authorized: false, error: 'Cross-origin unlock request rejected.' });
        }
        loadPersistedState();
        const body =
          req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const unlockToken = typeof body.unlockToken === 'string' ? body.unlockToken.trim() : '';
        const requestedProductKey = normalizeDocTypeToProductKey(
          body.docType ?? body.productKey ?? body.productCategory
        );
        const binding = resolveSessionBinding(req, body);
        const requestSessionId = binding.effectiveSessionId;

        if (!requestedProductKey) {
          return res.status(400).json({ authorized: false, error: 'Missing document type.' });
        }

        const cookieGrants = getVerifiedGrantsFromCookie(req, requestSessionId);
        let cookieGrantEntry =
          cookieGrants[requestedProductKey] ||
          findLatestActiveOrderGrantEntry(requestSessionId, requestedProductKey);

        if (!unlockToken && !cookieGrantEntry && requestSessionId) {
          cookieGrantEntry = await tryConfirmPendingOrderForProduct(
            req,
            res,
            requestSessionId,
            requestedProductKey
          );
        }

        if (!unlockToken && !cookieGrantEntry) {
          return res
            .status(401)
            .json({ authorized: false, error: 'Missing payment token or document type.' });
        }

        let result = await authorizeUnlockCandidate({
          requestedProductKey,
          unlockToken: unlockToken || undefined,
          cookieGrantEntry,
          requestSessionId,
        });

        // If a stale unlockToken failed while a valid HttpOnly cookie/server order exists for this product & session, authorize via cookieGrantEntry
        if (!result.authorized && unlockToken && cookieGrantEntry) {
          result = await authorizeUnlockCandidate({
            requestedProductKey,
            cookieGrantEntry,
            requestSessionId,
          });
        }

        if (!result.authorized) {
          if (result.clearGrant && requestSessionId && cookieGrants[requestedProductKey]) {
            delete cookieGrants[requestedProductKey];
            setSignedGrantsCookie(req, res, requestSessionId, cookieGrants);
          }
          return res.status(result.httpStatus).json({
            authorized: false,
            error: result.error,
          });
        }

        if (requestSessionId) {
          if (!binding.cookieSessionId || binding.cookieSessionId !== requestSessionId) {
            setSignedSessionCookie(req, res, requestSessionId);
          }
          cookieGrants[requestedProductKey] = result.cookieEntry;
          setSignedGrantsCookie(req, res, requestSessionId, cookieGrants);
        }

        return res.json({
          authorized: true,
          orderId: result.orderId,
          sid: result.sid,
          productKey: result.productKey,
          label: result.label,
          formattedPrice: result.formattedPrice,
          expiresAt: result.expiresAt,
          unlockToken: result.unlockToken,
        });
      } catch (err) {
        console.error('[Sifalo] Authorize unlock error:', err instanceof Error ? err.message : err);
        return res.status(500).json({ authorized: false, error: 'Authorization check failed.' });
      }
    });

    return router;
  }

  return {
    createRouter,
    handleWebhook,
    isConfigured: () => Boolean(getApiUser() && getApiKey()),
    getDiagnostics,
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
