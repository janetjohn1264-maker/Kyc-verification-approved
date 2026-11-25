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
  | 'proofOfAccount'
  | 'oneTimeAccess'
  | 'monthlyAccess';

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
  oneTimeAccess: {
    productKey: 'oneTimeAccess',
    label: 'One-Time Access',
    amountCents: 5500,
    amountUsdString: '55.00',
    formattedPrice: '$55.00',
    currency: 'USD',
    sifaloHostedMethods: ['card', 'mobile_money'],
    sifaloCardSupported: true,
    sifaloMethodRuleNote:
      'Amount is $55.00 (5500 cents > 51 cents threshold in Sifalo checkout.js), so Sifalo displays both Card and Mobile Money.',
  },
  monthlyAccess: {
    productKey: 'monthlyAccess',
    label: 'Monthly Access',
    amountCents: 1200,
    amountUsdString: '12.00',
    formattedPrice: '$12.00',
    currency: 'USD',
    sifaloHostedMethods: ['card', 'mobile_money'],
    sifaloCardSupported: true,
    sifaloMethodRuleNote:
      'Amount is $12.00 (1200 cents > 51 cents threshold in Sifalo checkout.js), so Sifalo displays both Card and Mobile Money.',
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
    case 'onetimeaccess':
    case 'onetime':
    case 'onetimeplan':
      return 'oneTimeAccess';
    case 'monthlyaccess':
    case 'monthly':
    case 'monthlyplan':
      return 'monthlyAccess';
    default:
      return null;
  }
}

export type UnlockLifecycleStatus =
  | 'CREATED'
  | 'PAYMENT_VERIFIED'
  | 'AUTHORIZED'
  | 'CONSUMED'
  | 'EXPIRED'
  | 'FAILED'
  | 'REVOKED';

export type UnlockAuditEventType =
  | 'UNLOCK_CREATED'
  | 'PAYMENT_VERIFICATION_STARTED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'UNLOCK_AUTHORIZED'
  | 'UNLOCK_CONSUMED'
  | 'UNLOCK_EXPIRED'
  | 'UNLOCK_REVOKED'
  | 'UNLOCK_REPLAY_BLOCKED'
  | 'PRODUCT_MISMATCH_BLOCKED'
  | 'INVALID_UNLOCK_BLOCKED';

export interface UnlockLifecycleAuditEvent {
  eventId: string;
  eventType: UnlockAuditEventType;
  timestamp: number;
  isoTimestamp: string;
  authorizationId: string | null;
  orderId: string | null;
  productKey: UnlockProductKey | null;
  requestedProductKey?: UnlockProductKey | null;
  lifecycleStatus: UnlockLifecycleStatus | null;
  sessionFingerprint: string | null;
  tokenFingerprint: string | null;
  reason?: string | null;
}

export interface UnlockAuthorizationAuditRecord {
  authorizationId: string;
  orderId: string;
  productKey: UnlockProductKey;
  amountCents: number;
  currency: 'USD';
  paymentVerificationResult: 'UNVERIFIED' | 'PENDING' | 'VERIFIED_PAID' | 'FAILED' | 'REVOKED';
  providerSidFingerprint: string | null;
  authorizationStatus: UnlockLifecycleStatus;
  createdAt: number;
  paymentVerifiedAt: number | null;
  authorizedAt: number | null;
  expiresAt: number | null;
  consumedAt: number | null;
  revokedAt: number | null;
  failedAt: number | null;
  expiredAt: number | null;
  sessionFingerprint: string | null;
  tokenFingerprint: string | null;
  failureOrRevocationReason: string | null;
  events: Array<{
    eventType: UnlockAuditEventType;
    timestamp: number;
    reason?: string | null;
  }>;
}

export interface SifaloOrderRecord {
  orderId: string;
  authorizationId?: string | null;
  productKey: UnlockProductKey;
  countryKey: string;
  providerKey: string;
  sessionId?: string | null;
  customerId?: string | null;
  amountCents: number;
  amountUsdString: string;
  currency: 'USD';
  environment: SifaloEnvironment;
  status: OrderStatus;
  lifecycleStatus?: UnlockLifecycleStatus;
  providerSid: string | null;
  providerToken: string | null;
  transactionRef: string | null;
  webhookAuthToken: string;
  createdAt: number;
  paidAt: number | null;
  authorizedAt?: number | null;
  revokedAt?: number | null;
  unlockTokenId: string | null;
  unlockTokenExpiresAt: number | null;
  unlockConsumedAt?: number | null;
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
  resolveAuthenticatedCustomerId?: (req: Request) => string | null;
  onVerifiedCustomerAccessOrder?: (
    order: SifaloOrderRecord,
    fallbackCustomerId?: string | null
  ) => unknown;
  onRevokedCustomerAccessOrder?: (order: SifaloOrderRecord, reason: string) => void;
  evaluateCustomerPaidAccess?: (req: Request) => {
    authorized: boolean;
    customerId: string | null;
    email: string | null;
    activePlan: 'oneTimeAccess' | 'monthlyAccess' | null;
    label: string | null;
    formattedPrice: string | null;
    orderId: string | null;
    sid: string | null;
    expiresAtMs: number;
  };
}

interface SignedOrderPayload {
  orderId: string;
  productKey: UnlockProductKey;
  countryKey: string;
  providerKey: string;
  sessionId?: string | null;
  customerId?: string | null;
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

// Short-lived single-use unlock token TTL (5 minutes max before consumption)
const UNLOCK_GRANT_TTL_MS = 5 * 60 * 1000;
const ORDER_EXPIRY_TTL_MS = 60 * 60 * 1000;
const STALE_ORDER_PRUNE_MS = 24 * 60 * 60 * 1000;
const MAX_PROCESSED_WEBHOOK_EVENTS = 5000;
const MAX_AUDIT_RECORDS = 1000;
const MAX_AUDIT_EVENTS = 2500;
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
  const autoDownloadConsumedOrders = new Set<string>();
  const unlockAuditRecords = new Map<string, UnlockAuthorizationAuditRecord>(); // orderId -> auditRecord
  const unlockAuditEvents: UnlockLifecycleAuditEvent[] = [];

  function computeOneWayFingerprint(prefix: string, rawSecretOrValue: string | null | undefined): string | null {
    if (!rawSecretOrValue || typeof rawSecretOrValue !== 'string' || !rawSecretOrValue.trim()) {
      return null;
    }
    const digest = crypto
      .createHmac('sha256', getSigningSecret())
      .update(`fp:${prefix}:${rawSecretOrValue.trim()}`)
      .digest('hex')
      .slice(0, 16);
    return `${prefix}_${digest}`;
  }

  function decodeTokenPayloadUnverified(rawToken: string | undefined): Partial<UnlockTokenPayload> | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const parts = rawToken.trim().split('.');
    if (parts.length !== 2) return null;
    try {
      const parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      if (parsed && typeof parsed === 'object') {
        return parsed as Partial<UnlockTokenPayload>;
      }
      return null;
    } catch {
      return null;
    }
  }

  function ensureAuditRecordForOrder(order: SifaloOrderRecord): UnlockAuthorizationAuditRecord {
    const existing = unlockAuditRecords.get(order.orderId);
    if (existing) {
      if (!order.authorizationId) {
        order.authorizationId = existing.authorizationId;
      }
      return existing;
    }
    const authId = order.authorizationId || `AUTH-${order.orderId.replace(/^KYC-/, '')}`;
    order.authorizationId = authId;
    const initialStatus: UnlockLifecycleStatus = order.lifecycleStatus || 'CREATED';
    order.lifecycleStatus = initialStatus;
    const record: UnlockAuthorizationAuditRecord = {
      authorizationId: authId,
      orderId: order.orderId,
      productKey: order.productKey,
      amountCents: order.amountCents,
      currency: order.currency,
      paymentVerificationResult: order.status === 'PAID' ? 'VERIFIED_PAID' : 'UNVERIFIED',
      providerSidFingerprint: computeOneWayFingerprint('sid', order.providerSid),
      authorizationStatus: initialStatus,
      createdAt: order.createdAt,
      paymentVerifiedAt: order.paidAt || null,
      authorizedAt: order.authorizedAt || null,
      expiresAt: order.unlockTokenExpiresAt || null,
      consumedAt: order.unlockConsumedAt || null,
      revokedAt: order.revokedAt || null,
      failedAt: null,
      expiredAt: null,
      sessionFingerprint: computeOneWayFingerprint('sess', order.sessionId),
      tokenFingerprint: computeOneWayFingerprint('tid', order.unlockTokenId),
      failureOrRevocationReason: null,
      events: [],
    };
    unlockAuditRecords.set(order.orderId, record);
    return record;
  }

  function recordUnlockAuditEvent(params: {
    eventType: UnlockAuditEventType;
    order?: SifaloOrderRecord | null;
    orderId?: string | null;
    authorizationId?: string | null;
    productKey?: UnlockProductKey | null;
    requestedProductKey?: UnlockProductKey | null;
    nextStatus?: UnlockLifecycleStatus | null;
    paymentVerificationResult?: UnlockAuthorizationAuditRecord['paymentVerificationResult'];
    sessionId?: string | null;
    rawTokenOrTid?: string | null;
    reason?: string | null;
  }): UnlockLifecycleAuditEvent {
    const ts = now();
    const ord = params.order || (params.orderId ? orders.get(params.orderId) || null : null);
    const auditRecord = ord ? ensureAuditRecordForOrder(ord) : null;

    if (auditRecord && ord) {
      if (params.nextStatus) {
        // Enforce terminal state immutability: once CONSUMED, REVOKED, or EXPIRED, never revert to AUTHORIZED
        const current = auditRecord.authorizationStatus;
        const isTerminal = current === 'CONSUMED' || current === 'REVOKED';
        if (!isTerminal || params.nextStatus === 'REVOKED') {
          auditRecord.authorizationStatus = params.nextStatus;
          ord.lifecycleStatus = params.nextStatus;
        }
      }
      if (params.paymentVerificationResult) {
        auditRecord.paymentVerificationResult = params.paymentVerificationResult;
      }
      if (ord.providerSid) {
        auditRecord.providerSidFingerprint = computeOneWayFingerprint('sid', ord.providerSid);
      }
      if (ord.sessionId || params.sessionId) {
        auditRecord.sessionFingerprint = computeOneWayFingerprint('sess', ord.sessionId || params.sessionId);
      }
      if (ord.unlockTokenId || params.rawTokenOrTid) {
        auditRecord.tokenFingerprint = computeOneWayFingerprint('tid', ord.unlockTokenId || params.rawTokenOrTid);
      }
      if (ord.paidAt) auditRecord.paymentVerifiedAt = ord.paidAt;
      if (ord.authorizedAt) auditRecord.authorizedAt = ord.authorizedAt;
      if (ord.unlockTokenExpiresAt) auditRecord.expiresAt = ord.unlockTokenExpiresAt;
      if (ord.unlockConsumedAt) auditRecord.consumedAt = ord.unlockConsumedAt;
      if (ord.revokedAt) auditRecord.revokedAt = ord.revokedAt;

      if (params.eventType === 'PAYMENT_VERIFICATION_FAILED' && params.nextStatus === 'FAILED') {
        auditRecord.failedAt = ts;
      }
      if (params.eventType === 'UNLOCK_EXPIRED') {
        auditRecord.expiredAt = ts;
      }
      if (params.eventType === 'UNLOCK_CONSUMED') {
        auditRecord.consumedAt = ord.unlockConsumedAt || ts;
      }
      if (params.eventType === 'UNLOCK_REVOKED') {
        auditRecord.revokedAt = ord.revokedAt || ts;
      }
      if (params.reason) {
        auditRecord.failureOrRevocationReason = params.reason;
      }
      auditRecord.events.push({
        eventType: params.eventType,
        timestamp: ts,
        reason: params.reason || null,
      });
      if (auditRecord.events.length > 60) {
        auditRecord.events.splice(0, auditRecord.events.length - 60);
      }
      unlockAuditRecords.set(ord.orderId, auditRecord);
    }

    const sessionFp =
      (auditRecord && auditRecord.sessionFingerprint) ||
      computeOneWayFingerprint('sess', params.sessionId || (ord ? ord.sessionId : null));
    const tokenFp =
      computeOneWayFingerprint('tok', params.rawTokenOrTid) ||
      (auditRecord ? auditRecord.tokenFingerprint : null);

    const eventEntry: UnlockLifecycleAuditEvent = {
      eventId: `EVT-${ts}-${crypto.randomBytes(3).toString('hex')}`,
      eventType: params.eventType,
      timestamp: ts,
      isoTimestamp: new Date(ts).toISOString(),
      authorizationId: (auditRecord && auditRecord.authorizationId) || params.authorizationId || null,
      orderId: (ord && ord.orderId) || params.orderId || null,
      productKey: (ord && ord.productKey) || params.productKey || null,
      requestedProductKey: params.requestedProductKey || (ord && ord.productKey) || params.productKey || null,
      lifecycleStatus: (auditRecord && auditRecord.authorizationStatus) || params.nextStatus || null,
      sessionFingerprint: sessionFp,
      tokenFingerprint: tokenFp,
      reason: params.reason || null,
    };

    unlockAuditEvents.push(eventEntry);
    if (unlockAuditEvents.length > MAX_AUDIT_EVENTS) {
      unlockAuditEvents.splice(0, unlockAuditEvents.length - MAX_AUDIT_EVENTS);
    }

    console.info(
      `[SifaloAudit] event=${eventEntry.eventType} status=${eventEntry.lifecycleStatus || 'NONE'} authId=${eventEntry.authorizationId || 'none'} orderId=${eventEntry.orderId || 'none'} product=${eventEntry.productKey || 'none'}${eventEntry.requestedProductKey && eventEntry.requestedProductKey !== eventEntry.productKey ? ` requestedProduct=${eventEntry.requestedProductKey}` : ''} sessFp=${eventEntry.sessionFingerprint || 'none'} tokFp=${eventEntry.tokenFingerprint || 'none'}${eventEntry.reason ? ` reason="${eventEntry.reason}"` : ''}`
    );

    return eventEntry;
  }

  function inspectAuthorizationLifecycle(orderIdOrAuthId: string): {
    found: boolean;
    currentlyValid: boolean;
    status: UnlockLifecycleStatus | 'NOT_FOUND';
    reason: string;
    record: UnlockAuthorizationAuditRecord | null;
  } {
    const cleanId = typeof orderIdOrAuthId === 'string' ? orderIdOrAuthId.trim() : '';
    let ord = orders.get(cleanId) || null;
    if (!ord) {
      for (const candidate of orders.values()) {
        if (candidate.authorizationId === cleanId) {
          ord = candidate;
          break;
        }
      }
    }
    const record = ord ? ensureAuditRecordForOrder(ord) : unlockAuditRecords.get(cleanId) || null;
    if (!ord && !record) {
      return {
        found: false,
        currentlyValid: false,
        status: 'NOT_FOUND',
        reason: 'Authorization record not found.',
        record: null,
      };
    }

    const currentTs = now();
    if (ord) {
      if (ord.revokedAt || ord.status === 'REFUNDED' || ord.status === 'REVERSED') {
        if (record && record.authorizationStatus !== 'REVOKED') {
          record.authorizationStatus = 'REVOKED';
          ord.lifecycleStatus = 'REVOKED';
        }
        return {
          found: true,
          currentlyValid: false,
          status: 'REVOKED',
          reason: record?.failureOrRevocationReason || 'Authorization was revoked due to refund or reversal.',
          record,
        };
      }
      if (ord.unlockConsumedAt) {
        if (record && record.authorizationStatus !== 'CONSUMED') {
          record.authorizationStatus = 'CONSUMED';
          ord.lifecycleStatus = 'CONSUMED';
        }
        return {
          found: true,
          currentlyValid: false,
          status: 'CONSUMED',
          reason: 'Authorization has already been consumed for a Save PNG operation.',
          record,
        };
      }
      if (ord.status === 'FAILED' || ord.status === 'CANCELLED') {
        if (record && record.authorizationStatus !== 'FAILED') {
          record.authorizationStatus = 'FAILED';
          ord.lifecycleStatus = 'FAILED';
        }
        return {
          found: true,
          currentlyValid: false,
          status: 'FAILED',
          reason: record?.failureOrRevocationReason || `Order status is ${ord.status}.`,
          record,
        };
      }
      if (
        ord.status === 'EXPIRED' ||
        (ord.status === 'PENDING' && currentTs - ord.createdAt > ORDER_EXPIRY_TTL_MS) ||
        (ord.status === 'PAID' && (!ord.unlockTokenExpiresAt || ord.unlockTokenExpiresAt <= currentTs))
      ) {
        if (record && record.authorizationStatus !== 'EXPIRED') {
          recordUnlockAuditEvent({
            eventType: 'UNLOCK_EXPIRED',
            order: ord,
            nextStatus: 'EXPIRED',
            reason:
              ord.status === 'PAID'
                ? 'Short-lived unlock authorization TTL expired before consumption.'
                : 'Unpaid checkout order expired.',
          });
        }
        return {
          found: true,
          currentlyValid: false,
          status: 'EXPIRED',
          reason: record?.failureOrRevocationReason || 'Authorization has expired.',
          record,
        };
      }
      if (
        ord.status === 'PAID' &&
        ord.providerSid &&
        ord.unlockTokenId &&
        ord.unlockTokenExpiresAt &&
        ord.unlockTokenExpiresAt > currentTs
      ) {
        return {
          found: true,
          currentlyValid: true,
          status: 'AUTHORIZED',
          reason: 'Authorization is currently valid, unconsumed, and within its short-lived TTL.',
          record,
        };
      }
    }

    return {
      found: true,
      currentlyValid: false,
      status: record ? record.authorizationStatus : 'CREATED',
      reason: record?.failureOrRevocationReason || 'Payment has not been verified yet.',
      record,
    };
  }

  function getUnlockAuditSummary() {
    const countsByStatus: Record<UnlockLifecycleStatus, number> = {
      CREATED: 0,
      PAYMENT_VERIFIED: 0,
      AUTHORIZED: 0,
      CONSUMED: 0,
      EXPIRED: 0,
      FAILED: 0,
      REVOKED: 0,
    };
    for (const ord of orders.values()) {
      const info = inspectAuthorizationLifecycle(ord.orderId);
      if (info.status !== 'NOT_FOUND') {
        countsByStatus[info.status] = (countsByStatus[info.status] || 0) + 1;
      }
    }
    const countsByEventType: Partial<Record<UnlockAuditEventType, number>> = {};
    for (const ev of unlockAuditEvents) {
      countsByEventType[ev.eventType] = (countsByEventType[ev.eventType] || 0) + 1;
    }
    return {
      unlockGrantTtlMs: UNLOCK_GRANT_TTL_MS,
      singleUseEnforced: true,
      totalTrackedAuthorizations: unlockAuditRecords.size,
      totalAuditEvents: unlockAuditEvents.length,
      countsByStatus,
      countsByEventType,
    };
  }

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
        autoDownloadConsumedOrders?: string[];
        unlockAuditRecords?: UnlockAuthorizationAuditRecord[];
        unlockAuditEvents?: UnlockLifecycleAuditEvent[];
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
      if (Array.isArray(parsed.autoDownloadConsumedOrders)) {
        for (const ordId of parsed.autoDownloadConsumedOrders) {
          if (typeof ordId === 'string') {
            autoDownloadConsumedOrders.add(ordId);
          }
        }
      }
      if (Array.isArray(parsed.unlockAuditRecords)) {
        for (const rec of parsed.unlockAuditRecords) {
          if (rec && typeof rec.orderId === 'string') {
            unlockAuditRecords.set(rec.orderId, rec);
          }
        }
      }
      if (Array.isArray(parsed.unlockAuditEvents)) {
        unlockAuditEvents.length = 0;
        for (const ev of parsed.unlockAuditEvents.slice(-MAX_AUDIT_EVENTS)) {
          if (ev && typeof ev.eventType === 'string') {
            unlockAuditEvents.push(ev);
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
        autoDownloadConsumedOrders: Array.from(autoDownloadConsumedOrders.values()).slice(-MAX_PROCESSED_WEBHOOK_EVENTS),
        unlockAuditRecords: Array.from(unlockAuditRecords.values()).slice(-MAX_AUDIT_RECORDS),
        unlockAuditEvents: unlockAuditEvents.slice(-MAX_AUDIT_EVENTS),
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
      order.unlockConsumedAt ||
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
      customerId: order.customerId || null,
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
        if (!existing.customerId && typeof parsed.customerId === 'string' && parsed.customerId.trim()) {
          existing.customerId = parsed.customerId.trim();
        }
        return existing;
      }
      const recovered: SifaloOrderRecord = {
        orderId: parsed.orderId,
        productKey: parsed.productKey,
        countryKey: sanitizeShortSlug(parsed.countryKey, 'global'),
        providerKey: sanitizeShortSlug(parsed.providerKey, 'virtual-account'),
        sessionId: sanitizeSessionId(parsed.sessionId),
        customerId: typeof parsed.customerId === 'string' && parsed.customerId.trim() ? parsed.customerId.trim() : null,
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
        unlockConsumedAt: null,
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
    if (
      order.status !== 'PAID' ||
      order.revokedAt ||
      order.unlockConsumedAt ||
      !order.unlockTokenId ||
      !order.unlockTokenExpiresAt
    ) {
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

  function invalidateOrderUnlock(order: SifaloOrderRecord, nextStatus: OrderStatus, reason?: string) {
    order.status = nextStatus;
    order.revokedAt = now();
    order.lifecycleStatus = 'REVOKED';
    order.unlockTokenId = null;
    order.unlockTokenExpiresAt = null;
    recordUnlockAuditEvent({
      eventType: 'UNLOCK_REVOKED',
      order,
      nextStatus: 'REVOKED',
      paymentVerificationResult: 'REVOKED',
      reason: reason || `Order invalidated with status ${nextStatus}.`,
    });
    orders.set(order.orderId, order);
    persistState();
    if (deps.onRevokedCustomerAccessOrder) {
      try {
        deps.onRevokedCustomerAccessOrder(
          order,
          reason || `Order invalidated with status ${nextStatus}.`
        );
      } catch {}
    }
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
      recordUnlockAuditEvent({
        eventType: 'UNLOCK_REVOKED',
        order,
        nextStatus: 'REVOKED',
        paymentVerificationResult: 'REVOKED',
        reason: `Payment is ${order.status.toLowerCase()}.`,
      });
      return {
        ok: false,
        status: order.status,
        error: `Payment ${order.status.toLowerCase()}. Document download is not permitted.`,
      };
    }

    if (order.unlockConsumedAt) {
      recordUnlockAuditEvent({
        eventType: 'UNLOCK_REPLAY_BLOCKED',
        order,
        nextStatus: 'CONSUMED',
        reason: 'Attempted to re-verify or reuse an already consumed payment authorization.',
      });
      return {
        ok: false,
        status: 'EXPIRED',
        error: 'This payment authorization has already been consumed. Please start a new payment.',
      };
    }

    if (preserveGrant && preserveGrant.expiresAt <= now()) {
      recordUnlockAuditEvent({
        eventType: 'UNLOCK_EXPIRED',
        order,
        nextStatus: 'EXPIRED',
        reason: 'Unlock token TTL expired before verification completed.',
      });
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

    recordUnlockAuditEvent({
      eventType: 'PAYMENT_VERIFICATION_STARTED',
      order,
      paymentVerificationResult: order.status === 'PAID' ? 'VERIFIED_PAID' : 'PENDING',
      reason: 'Verifying transaction with Sifalo Pay verify.php API.',
    });

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
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        reason: 'Could not reach Sifalo Pay verification gateway.',
      });
      return {
        ok: false,
        status: order.status,
        isPending: order.status === 'PENDING',
        error: 'Could not reach Sifalo Pay verification gateway.',
      };
    }

    if (!res.ok || !data) {
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        reason: 'Invalid verification response from Sifalo Pay.',
      });
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
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        paymentVerificationResult: 'PENDING',
        reason: 'Payment has not been completed or recorded at Sifalo Pay yet.',
      });
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
        invalidateOrderUnlock(order, nonSuccess, `Sifalo reported ${nonSuccess}.`);
      } else if (nonSuccess !== 'PENDING' && order.status === 'PENDING') {
        order.status = nonSuccess;
        const mappedLifecycle: UnlockLifecycleStatus =
          nonSuccess === 'EXPIRED' ? 'EXPIRED' : 'FAILED';
        order.lifecycleStatus = mappedLifecycle;
        recordUnlockAuditEvent({
          eventType: nonSuccess === 'EXPIRED' ? 'UNLOCK_EXPIRED' : 'PAYMENT_VERIFICATION_FAILED',
          order,
          nextStatus: mappedLifecycle,
          paymentVerificationResult: 'FAILED',
          reason: `Sifalo reported payment ${nonSuccess.toLowerCase()}.`,
        });
        orders.set(order.orderId, order);
        persistState();
      } else {
        recordUnlockAuditEvent({
          eventType: 'PAYMENT_VERIFICATION_FAILED',
          order,
          paymentVerificationResult: nonSuccess === 'PENDING' ? 'PENDING' : 'FAILED',
          reason:
            nonSuccess === 'PENDING'
              ? 'Payment is still awaiting confirmation from Sifalo Pay.'
              : `Payment ${nonSuccess.toLowerCase()}.`,
        });
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
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        paymentVerificationResult: order.status === 'PENDING' ? 'PENDING' : 'FAILED',
        reason: 'Sifalo Pay did not confirm payment success (status=success, code=601 required).',
      });
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
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        paymentVerificationResult: 'FAILED',
        reason: 'Verified Sifalo transaction belongs to a different order ID.',
      });
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
        recordUnlockAuditEvent({
          eventType: 'PRODUCT_MISMATCH_BLOCKED',
          order,
          requestedProductKey: normalizedProduct || undefined,
          paymentVerificationResult: 'FAILED',
          reason: 'Verified Sifalo product type does not match order document.',
        });
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
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        paymentVerificationResult: 'FAILED',
        reason: 'Verified Sifalo payment currency mismatch (USD required).',
      });
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
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        paymentVerificationResult: 'FAILED',
        reason: 'Verified Sifalo payment amount does not match product price.',
      });
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
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        paymentVerificationResult: 'FAILED',
        reason: 'Verified Sifalo payment response is missing a valid transaction SID.',
      });
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo payment response is missing a valid transaction SID.',
      };
    }

    if (order.providerSid && order.providerSid !== verifiedSid) {
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFICATION_FAILED',
        order,
        paymentVerificationResult: 'FAILED',
        reason: 'Verified Sifalo transaction SID does not match order SID.',
      });
      return {
        ok: false,
        status: order.status,
        error: 'Verified Sifalo transaction SID does not match order SID.',
      };
    }

    const existingOwner = consumedTransactions.get(verifiedSid);
    if (existingOwner && existingOwner !== order.orderId) {
      recordUnlockAuditEvent({
        eventType: 'UNLOCK_REPLAY_BLOCKED',
        order,
        paymentVerificationResult: 'FAILED',
        reason: 'This Sifalo checkout transaction SID has already been used for another order.',
      });
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

    // Bind & atomically transition CREATED -> PAYMENT_VERIFIED -> AUTHORIZED
    if (order.status !== 'PAID') {
      const paidAt = now();
      order.status = 'PAID';
      order.paidAt = paidAt;
      order.authorizedAt = paidAt;
      order.revokedAt = null;
      if (preserveGrant && preserveGrant.tid && preserveGrant.expiresAt > paidAt) {
        order.unlockTokenId = preserveGrant.tid;
        order.unlockTokenExpiresAt = preserveGrant.expiresAt;
      } else {
        order.unlockTokenId = crypto.randomUUID();
        order.unlockTokenExpiresAt = paidAt + UNLOCK_GRANT_TTL_MS;
      }
      recordUnlockAuditEvent({
        eventType: 'PAYMENT_VERIFIED',
        order,
        nextStatus: 'PAYMENT_VERIFIED',
        paymentVerificationResult: 'VERIFIED_PAID',
        rawTokenOrTid: order.unlockTokenId,
        reason: `Sifalo payment verified ($${order.amountUsdString} USD).`,
      });
      recordUnlockAuditEvent({
        eventType: 'UNLOCK_AUTHORIZED',
        order,
        nextStatus: 'AUTHORIZED',
        paymentVerificationResult: 'VERIFIED_PAID',
        rawTokenOrTid: order.unlockTokenId,
        reason: `Short-lived single-use unlock authorization issued (TTL ${Math.round(UNLOCK_GRANT_TTL_MS / 1000)}s).`,
      });
      orders.set(order.orderId, order);
      persistState();
      if (deps.onVerifiedCustomerAccessOrder) {
        try {
          deps.onVerifiedCustomerAccessOrder(order, order.customerId || null);
        } catch {}
      }
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
      unlockLifecycleSummary: getUnlockAuditSummary(),
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

        const authorizationId = `AUTH-${orderId.replace(/^KYC-/, '')}`;
        const authenticatedCustomerId = deps.resolveAuthenticatedCustomerId
          ? deps.resolveAuthenticatedCustomerId(req)
          : null;
        if (
          (productKey === 'oneTimeAccess' || productKey === 'monthlyAccess') &&
          deps.resolveAuthenticatedCustomerId &&
          !authenticatedCustomerId
        ) {
          return res.status(401).json({
            ok: false,
            requiresCustomerAuth: true,
            productKey,
            productCode: productKey === 'monthlyAccess' ? 'MONTHLY_ACCESS' : 'ONE_TIME_ACCESS',
            error: 'Please log in or create a customer account before proceeding to payment.',
          });
        }
        const order: SifaloOrderRecord = {
          orderId,
          authorizationId,
          productKey,
          countryKey,
          providerKey,
          sessionId,
          customerId: authenticatedCustomerId || null,
          amountCents: priceSpec.amountCents,
          amountUsdString: priceSpec.amountUsdString,
          currency: priceSpec.currency,
          environment,
          status: 'PENDING',
          lifecycleStatus: 'CREATED',
          providerSid: null,
          providerToken: null,
          transactionRef: null,
          webhookAuthToken,
          createdAt: now(),
          paidAt: null,
          authorizedAt: null,
          revokedAt: null,
          unlockTokenId: null,
          unlockTokenExpiresAt: null,
          unlockConsumedAt: null,
        };
        orders.set(orderId, order);
        recordUnlockAuditEvent({
          eventType: 'UNLOCK_CREATED',
          order,
          nextStatus: 'CREATED',
          paymentVerificationResult: 'UNVERIFIED',
          sessionId,
          reason: `Created Sifalo checkout order for ${priceSpec.label} ($${priceSpec.amountUsdString} USD).`,
        });

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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

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
          order.lifecycleStatus = 'EXPIRED';
          recordUnlockAuditEvent({
            eventType: 'UNLOCK_EXPIRED',
            order,
            nextStatus: 'EXPIRED',
            paymentVerificationResult: 'FAILED',
            sessionId: requestSessionId,
            reason: 'Pending checkout order expired after 60 minutes without payment.',
          });
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
                order.lifecycleStatus = 'FAILED';
                recordUnlockAuditEvent({
                  eventType: 'PAYMENT_VERIFICATION_FAILED',
                  order,
                  nextStatus: 'FAILED',
                  paymentVerificationResult: 'FAILED',
                  sessionId: requestSessionId,
                  reason: 'Payment was cancelled by user before Sifalo confirmation.',
                });
                orders.set(order.orderId, order);
                persistState();
                clearSignedPendingCheckoutCookie(req, res);
                effectiveError =
                  'Payment was cancelled before confirmation. Save PNG & Download remain locked.';
              } else if (returnStatus === 'failed' || returnStatus === 'error') {
                effectiveStatus = 'FAILED';
                order.status = 'FAILED';
                order.lifecycleStatus = 'FAILED';
                recordUnlockAuditEvent({
                  eventType: 'PAYMENT_VERIFICATION_FAILED',
                  order,
                  nextStatus: 'FAILED',
                  paymentVerificationResult: 'FAILED',
                  sessionId: requestSessionId,
                  reason: returnMessage
                    ? `Payment failed on Sifalo checkout (${returnMessage}).`
                    : 'Payment failed on Sifalo checkout.',
                });
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
          recordUnlockAuditEvent({
            eventType: 'PAYMENT_VERIFICATION_FAILED',
            order,
            sessionId: requestSessionId,
            reason: 'Order is not PAID or missing verified Sifalo transaction SID.',
          });
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

        if (order.unlockConsumedAt) {
          clearSignedPendingCheckoutCookie(req, res);
          recordUnlockAuditEvent({
            eventType: 'UNLOCK_REPLAY_BLOCKED',
            order,
            nextStatus: 'CONSUMED',
            sessionId: requestSessionId,
            reason: 'Blocked verify-order replay on an already consumed payment authorization.',
          });
          return res.status(403).json({
            verified: false,
            status: 'EXPIRED',
            orderId: order.orderId,
            productKey: order.productKey,
            label: priceSpec.label,
            formattedPrice: priceSpec.formattedPrice,
            error: 'This payment authorization has already been used. Please start a new payment.',
          });
        }

        const grant = issueOrderUnlockGrant(order);
        if (!grant) {
          clearSignedPendingCheckoutCookie(req, res);
          recordUnlockAuditEvent({
            eventType: 'UNLOCK_EXPIRED',
            order,
            nextStatus: 'EXPIRED',
            sessionId: requestSessionId,
            reason: 'Short-lived unlock authorization expired before it could be issued.',
          });
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
        // Clear any legacy grants cookie so browser cookies never act as persistent proof of payment
        setSignedGrantsCookie(req, res, activeSessionId, {});

        let customerEntitlement = null;
        if (deps.onVerifiedCustomerAccessOrder) {
          try {
            const currentCustomerId = deps.resolveAuthenticatedCustomerId
              ? deps.resolveAuthenticatedCustomerId(req)
              : null;
            customerEntitlement = deps.onVerifiedCustomerAccessOrder(
              order,
              order.customerId || currentCustomerId || null
            );
          } catch {}
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
          autoDownloadEligible: !autoDownloadConsumedOrders.has(order.orderId),
          customerEntitlement: customerEntitlement || null,
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
          // Inspect unverified payload purely to distinguish expired valid tokens from forged/corrupted tokens in server audit
          const unverified = decodeTokenPayloadUnverified(unlockToken);
          const candidateOrd =
            unverified && typeof unverified.orderId === 'string'
              ? orders.get(unverified.orderId) || null
              : null;
          if (
            candidateOrd &&
            unverified &&
            typeof unverified.exp === 'number' &&
            unverified.exp <= now() &&
            !candidateOrd.unlockConsumedAt
          ) {
            recordUnlockAuditEvent({
              eventType: 'UNLOCK_EXPIRED',
              order: candidateOrd,
              requestedProductKey,
              nextStatus: 'EXPIRED',
              sessionId: requestSessionId,
              rawTokenOrTid: unlockToken,
              reason: 'Unlock token expired beyond its short-lived 5-minute TTL.',
            });
            persistState();
          } else {
            recordUnlockAuditEvent({
              eventType: 'INVALID_UNLOCK_BLOCKED',
              order: candidateOrd,
              orderId:
                (unverified && typeof unverified.orderId === 'string' && unverified.orderId) || null,
              requestedProductKey,
              sessionId: requestSessionId,
              rawTokenOrTid: unlockToken,
              reason: 'Forged, malformed, or expired unlock token signature rejected.',
            });
          }
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
        recordUnlockAuditEvent({
          eventType: 'INVALID_UNLOCK_BLOCKED',
          requestedProductKey,
          sessionId: requestSessionId,
          reason: 'Missing payment authorization token.',
        });
        return {
          authorized: false,
          httpStatus: 401,
          error: 'Missing payment authorization token.',
        };
      }

      let order = orders.get(payload.orderId);

      if (payload.productKey !== requestedProductKey) {
        recordUnlockAuditEvent({
          eventType: 'PRODUCT_MISMATCH_BLOCKED',
          order,
          orderId: payload.orderId,
          productKey: payload.productKey,
          requestedProductKey,
          sessionId: requestSessionId,
          rawTokenOrTid: payload.tid,
          reason: `Authorization for product "${payload.productKey}" cannot unlock requested product "${requestedProductKey}".`,
        });
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization is not valid for this document category.',
        };
      }

      if (payload.sessionId && payload.sessionId !== requestSessionId) {
        recordUnlockAuditEvent({
          eventType: 'INVALID_UNLOCK_BLOCKED',
          order,
          orderId: payload.orderId,
          productKey: payload.productKey,
          requestedProductKey,
          sessionId: requestSessionId,
          rawTokenOrTid: payload.tid,
          reason: 'Payment authorization belongs to a different user session.',
        });
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization belongs to a different user session.',
        };
      }

      if (payload.amountCents !== undefined && payload.amountCents !== expectedSpec.amountCents) {
        recordUnlockAuditEvent({
          eventType: 'INVALID_UNLOCK_BLOCKED',
          order,
          orderId: payload.orderId,
          productKey: payload.productKey,
          requestedProductKey,
          sessionId: requestSessionId,
          rawTokenOrTid: payload.tid,
          reason: 'Payment authorization amount does not match document requirement.',
        });
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization amount does not match document requirement.',
          clearGrant: true,
        };
      }

      if (payload.currency !== undefined && payload.currency !== 'USD') {
        recordUnlockAuditEvent({
          eventType: 'INVALID_UNLOCK_BLOCKED',
          order,
          orderId: payload.orderId,
          productKey: payload.productKey,
          requestedProductKey,
          sessionId: requestSessionId,
          rawTokenOrTid: payload.tid,
          reason: 'Payment authorization currency mismatch.',
        });
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization currency mismatch.',
          clearGrant: true,
        };
      }

      // Explicitly reject consumed, revoked, refunded, reversed, cancelled, failed, or expired orders
      if (order) {
        if (order.unlockConsumedAt) {
          recordUnlockAuditEvent({
            eventType: 'UNLOCK_REPLAY_BLOCKED',
            order,
            requestedProductKey,
            nextStatus: 'CONSUMED',
            sessionId: requestSessionId,
            rawTokenOrTid: payload.tid,
            reason: 'Blocked attempt to reuse an already CONSUMED single-use authorization.',
          });
          persistState();
          return {
            authorized: false,
            httpStatus: 403,
            error: 'Payment authorization has already been consumed or is no longer active.',
            clearGrant: true,
          };
        }
        if (order.revokedAt || order.status === 'REFUNDED' || order.status === 'REVERSED') {
          recordUnlockAuditEvent({
            eventType: 'UNLOCK_REVOKED',
            order,
            requestedProductKey,
            nextStatus: 'REVOKED',
            sessionId: requestSessionId,
            rawTokenOrTid: payload.tid,
            reason: 'Blocked attempt to use a REVOKED authorization.',
          });
          return {
            authorized: false,
            httpStatus: 403,
            error: 'Payment authorization has already been consumed or is no longer active.',
            clearGrant: true,
          };
        }
        if (order.status === 'CANCELLED' || order.status === 'EXPIRED' || order.status === 'FAILED') {
          recordUnlockAuditEvent({
            eventType: order.status === 'EXPIRED' ? 'UNLOCK_EXPIRED' : 'INVALID_UNLOCK_BLOCKED',
            order,
            requestedProductKey,
            nextStatus: order.status === 'EXPIRED' ? 'EXPIRED' : 'FAILED',
            sessionId: requestSessionId,
            rawTokenOrTid: payload.tid,
            reason: `Order status is ${order.status}.`,
          });
          return {
            authorized: false,
            httpStatus: 403,
            error: 'Payment authorization has already been consumed or is no longer active.',
            clearGrant: true,
          };
        }
      }

      // Serverless / cold-start / cross-instance recovery:
      // If this server instance lacks the PAID record (or still holds PENDING from checkout creation
      // before another instance processed verify-order/webhook), re-verify directly against Sifalo's API.
      if (!order || order.status === 'PENDING') {
        const sidToCheck = typeof payload.sid === 'string' ? payload.sid.trim() : '';
        if (!sidToCheck) {
          recordUnlockAuditEvent({
            eventType: 'INVALID_UNLOCK_BLOCKED',
            order,
            orderId: payload.orderId,
            requestedProductKey,
            sessionId: requestSessionId,
            rawTokenOrTid: payload.tid,
            reason: 'Paid order record not found on server and no provider SID present.',
          });
          return {
            authorized: false,
            httpStatus: 403,
            error: 'Paid order record not found on server.',
            clearGrant: true,
          };
        }

        if (order && order.sessionId && order.sessionId !== requestSessionId) {
          recordUnlockAuditEvent({
            eventType: 'INVALID_UNLOCK_BLOCKED',
            order,
            requestedProductKey,
            sessionId: requestSessionId,
            rawTokenOrTid: payload.tid,
            reason: 'Payment authorization belongs to a different user session.',
          });
          return {
            authorized: false,
            httpStatus: 403,
            error: 'Payment authorization belongs to a different user session.',
          };
        }

        const candidateOrder: SifaloOrderRecord = order ?? {
          orderId: payload.orderId,
          authorizationId: `AUTH-${payload.orderId.replace(/^KYC-/, '')}`,
          productKey: requestedProductKey,
          countryKey: 'global',
          providerKey: 'virtual-account',
          sessionId: payload.sessionId ?? requestSessionId ?? null,
          amountCents: expectedSpec.amountCents,
          amountUsdString: expectedSpec.amountUsdString,
          currency: 'USD',
          environment: candidateEnv,
          status: 'PENDING',
          lifecycleStatus: 'CREATED',
          providerSid: sidToCheck,
          providerToken: null,
          transactionRef: null,
          webhookAuthToken: computeOrderWebhookToken(payload.orderId),
          createdAt: candidateCreatedAt,
          paidAt: null,
          authorizedAt: null,
          revokedAt: null,
          unlockTokenId: null,
          unlockTokenExpiresAt: null,
          unlockConsumedAt: null,
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

      if (order.productKey !== requestedProductKey) {
        recordUnlockAuditEvent({
          eventType: 'PRODUCT_MISMATCH_BLOCKED',
          order,
          requestedProductKey,
          sessionId: requestSessionId,
          rawTokenOrTid: payload.tid,
          reason: `Order product "${order.productKey}" does not match requested product "${requestedProductKey}".`,
        });
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Payment authorization is not valid for this document category.',
          clearGrant: true,
        };
      }

      if (
        !order.unlockTokenExpiresAt ||
        order.unlockTokenExpiresAt <= now()
      ) {
        recordUnlockAuditEvent({
          eventType: 'UNLOCK_EXPIRED',
          order,
          requestedProductKey,
          nextStatus: 'EXPIRED',
          sessionId: requestSessionId,
          rawTokenOrTid: payload.tid,
          reason: 'Order unlock token TTL has expired.',
        });
        persistState();
        return {
          authorized: false,
          httpStatus: 403,
          error: 'Paid order verification is no longer active.',
          clearGrant: true,
        };
      }

      if (
        order.status !== 'PAID' ||
        order.revokedAt ||
        order.unlockConsumedAt ||
        !order.providerSid ||
        order.productKey !== payload.productKey ||
        order.amountCents !== expectedSpec.amountCents ||
        order.currency !== 'USD' ||
        order.unlockTokenId !== payload.tid ||
        (order.sessionId && order.sessionId !== requestSessionId)
      ) {
        recordUnlockAuditEvent({
          eventType: order.unlockConsumedAt ? 'UNLOCK_REPLAY_BLOCKED' : 'INVALID_UNLOCK_BLOCKED',
          order,
          requestedProductKey,
          sessionId: requestSessionId,
          rawTokenOrTid: payload.tid,
          reason: 'Order authorization state or token ID mismatch.',
        });
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
          !ord.unlockConsumedAt &&
          !autoDownloadConsumedOrders.has(ord.orderId) &&
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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

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

        // Never auto-unlock from cookies or old session history on page refresh;
        // only validate explicitly provided, unconsumed, non-expired candidate unlock tokens.
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

          if (!candidateToken) {
            continue;
          }

          const auth = await authorizeUnlockCandidate({
            requestedProductKey: productKey,
            unlockToken: candidateToken,
            requestSessionId: sessionId,
          });

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
          }
        }

        // Clear any legacy grants cookie so browser refresh never inherits a persistent unlock
        setSignedGrantsCookie(req, res, sessionId, {});

        const customerPaidAccess = deps.evaluateCustomerPaidAccess
          ? deps.evaluateCustomerPaidAccess(req)
          : null;

        return res.status(200).json({
          authenticatedSession: true,
          sessionId,
          unlockedProducts,
          customerPaidAccess:
            customerPaidAccess && customerPaidAccess.authorized
              ? {
                  authorized: true,
                  activePlan: customerPaidAccess.activePlan,
                  label: customerPaidAccess.label,
                  formattedPrice: customerPaidAccess.formattedPrice,
                  orderId: customerPaidAccess.orderId,
                  sid: customerPaidAccess.sid,
                  expiresAt: customerPaidAccess.expiresAtMs,
                }
              : null,
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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

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

        // Check if the caller is an authenticated customer with active server-verified One-Time Access ($55) or active non-expired Monthly Access ($12/month)
        if (deps.evaluateCustomerPaidAccess) {
          const customerAccess = deps.evaluateCustomerPaidAccess(req);
          if (customerAccess && customerAccess.authorized) {
            const spec = AUTHORITATIVE_PRODUCT_PRICING[requestedProductKey];
            return res.status(200).json({
              authorized: true,
              consumed: false,
              autoDownloadAuthorized: Boolean(body.consumePostPaymentAutoDownload),
              authorizationSource: 'customer_paid_access',
              activePlan: customerAccess.activePlan,
              orderId: customerAccess.orderId || '',
              sid: customerAccess.sid || '',
              productKey: requestedProductKey,
              label: spec ? spec.label : customerAccess.label || '',
              formattedPrice: spec ? spec.formattedPrice : customerAccess.formattedPrice || '',
              expiresAt: customerAccess.expiresAtMs,
              unlockToken: '',
            });
          }
        }

        // Require an explicit, server-signed unlockToken (never fall back to persistent cookies or old session history)
        if (!unlockToken) {
          recordUnlockAuditEvent({
            eventType: 'INVALID_UNLOCK_BLOCKED',
            requestedProductKey,
            sessionId: requestSessionId,
            reason: 'Save PNG attempted without a payment authorization token.',
          });
          return res
            .status(401)
            .json({ authorized: false, error: 'Missing payment token or document type.' });
        }

        const result = await authorizeUnlockCandidate({
          requestedProductKey,
          unlockToken,
          requestSessionId,
        });

        if (!result.authorized) {
          if (requestSessionId) {
            setSignedGrantsCookie(req, res, requestSessionId, {});
          }
          return res.status(result.httpStatus).json({
            authorized: false,
            error: result.error,
          });
        }

        const expectedOrderId =
          typeof body.orderId === 'string' && body.orderId.trim()
            ? body.orderId.trim()
            : result.orderId;
        if (expectedOrderId !== result.orderId) {
          recordUnlockAuditEvent({
            eventType: 'INVALID_UNLOCK_BLOCKED',
            orderId: result.orderId,
            productKey: result.productKey,
            requestedProductKey,
            sessionId: requestSessionId,
            rawTokenOrTid: unlockToken,
            reason: `Order ID mismatch (expected ${expectedOrderId}, token bound to ${result.orderId}).`,
          });
          return res.status(403).json({
            authorized: false,
            error: 'Order ID mismatch for payment authorization.',
          });
        }

        if (requestSessionId && (!binding.cookieSessionId || binding.cookieSessionId !== requestSessionId)) {
          setSignedSessionCookie(req, res, requestSessionId);
        }

        const consumePostPaymentAutoDownload = body.consumePostPaymentAutoDownload === true;
        // Single-use consumption: consume and invalidate the unlock authorization immediately unless consumeUnlock === false
        const shouldConsumeUnlock = body.consumeUnlock !== false && !consumePostPaymentAutoDownload;
        let autoDownloadAuthorized = false;

        if (consumePostPaymentAutoDownload) {
          if (!autoDownloadConsumedOrders.has(result.orderId)) {
            autoDownloadConsumedOrders.add(result.orderId);
            autoDownloadAuthorized = true;
          } else {
            recordUnlockAuditEvent({
              eventType: 'UNLOCK_REPLAY_BLOCKED',
              orderId: result.orderId,
              productKey: result.productKey,
              requestedProductKey,
              sessionId: requestSessionId,
              rawTokenOrTid: unlockToken,
              reason: 'Blocked duplicate post-payment automatic download attempt for the same order.',
            });
          }
        }

        const authorizedOrder = orders.get(result.orderId);
        if (shouldConsumeUnlock) {
          const consumedTokenTid = authorizedOrder?.unlockTokenId || unlockToken;
          autoDownloadConsumedOrders.add(result.orderId);
          if (authorizedOrder) {
            authorizedOrder.unlockConsumedAt = now();
            authorizedOrder.lifecycleStatus = 'CONSUMED';
            authorizedOrder.unlockTokenId = null;
            authorizedOrder.unlockTokenExpiresAt = null;
            recordUnlockAuditEvent({
              eventType: 'UNLOCK_CONSUMED',
              order: authorizedOrder,
              requestedProductKey,
              nextStatus: 'CONSUMED',
              sessionId: requestSessionId,
              rawTokenOrTid: consumedTokenTid,
              reason: 'Single-use Save PNG authorization consumed and invalidated.',
            });
            orders.set(authorizedOrder.orderId, authorizedOrder);
          }
          if (requestSessionId) {
            setSignedGrantsCookie(req, res, requestSessionId, {});
          }
          persistState();
        } else if (consumePostPaymentAutoDownload) {
          persistState();
        }

        return res.json({
          authorized: true,
          consumed: shouldConsumeUnlock,
          autoDownloadAuthorized,
          orderId: result.orderId,
          sid: result.sid,
          productKey: result.productKey,
          label: result.label,
          formattedPrice: result.formattedPrice,
          expiresAt: shouldConsumeUnlock ? 0 : result.expiresAt,
          unlockToken: shouldConsumeUnlock ? '' : result.unlockToken,
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
    inspectAuthorizationLifecycle,
    getUnlockAuditSummary,
    _internal: {
      orders,
      sidToOrderId,
      consumedTransactions,
      processedWebhookEvents,
      unlockAuditRecords,
      unlockAuditEvents,
      inspectAuthorizationLifecycle,
      getUnlockAuditSummary,
      verifyUnlockTokenString,
      computeOrderWebhookToken,
      signOrderStateToken,
      recoverOrderFromStateToken,
    },
  };
}
