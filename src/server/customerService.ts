import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { AUTHORITATIVE_PRODUCT_PRICING, type SifaloOrderRecord } from './sifaloPayments.js';

export type CustomerPlanStatus = 'INACTIVE' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface CustomerOneTimeEntitlement {
  status: 'INACTIVE' | 'ACTIVE' | 'REVOKED';
  active: boolean;
  orderId: string | null;
  providerSid: string | null;
  amountCents: number | null;
  amountUsd: string | null;
  currency: 'USD';
  activatedAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface CustomerMonthlyEntitlement {
  status: CustomerPlanStatus;
  active: boolean;
  orderId: string | null;
  providerSid: string | null;
  amountCents: number | null;
  amountUsd: string | null;
  currency: 'USD';
  activatedAt: string | null;
  expiresAt: string | null;
  expiresAtMs: number | null;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface CustomerAccountRecord {
  customerId: string;
  username?: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  oneTimeAccess: CustomerOneTimeEntitlement;
  monthlyAccess: CustomerMonthlyEntitlement;
  appliedOrderIds: string[];
}

export interface CustomerSessionRecord {
  sessionId: string;
  tokenHash: string;
  customerId: string;
  email: string;
  createdAtMs: number;
  expiresAtMs: number;
  lastActiveAtMs: number;
}

export interface PublicCustomerAccountView {
  customerId: string;
  username: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
  hasActivePaidAccess: boolean;
  activeAccessType: 'oneTimeAccess' | 'monthlyAccess' | 'none';
  accessStatusLabel: string;
  oneTimeAccess: {
    status: 'INACTIVE' | 'ACTIVE' | 'REVOKED';
    active: boolean;
    statusLabel: string;
    priceLabel: string;
    activatedAt: string | null;
    revokedAt: string | null;
    orderId: string | null;
  };
  monthlyAccess: {
    status: CustomerPlanStatus;
    active: boolean;
    statusLabel: string;
    priceLabel: string;
    activatedAt: string | null;
    expiresAt: string | null;
    expiresAtMs: number | null;
    revokedAt: string | null;
    orderId: string | null;
  };
}

export interface PublicPendingPlanView {
  productKey: 'oneTimeAccess' | 'monthlyAccess';
  productCode: 'ONE_TIME_ACCESS' | 'MONTHLY_ACCESS';
  label: 'One-Time Access' | 'Monthly Access';
  amountCents: number;
  amountUsd: string;
  formattedPrice: string;
  displayPrice: string;
  currency: 'USD';
  expiresAtMs: number;
}

interface CustomerPendingPlanIntentRecord extends PublicPendingPlanView {
  intentId: string;
  tokenHash: string;
  createdAtMs: number;
}

interface PersistedCustomerState {
  customers: CustomerAccountRecord[];
}

const CUSTOMER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PLAN_INTENT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MONTHLY_ACCESS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CUSTOMER_COOKIE_NAME = 'kyc_customer_session';
const CUSTOMER_PLAN_INTENT_COOKIE_NAME = 'kyc_customer_plan_intent';
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_AUTH_FAILURES_PER_WINDOW = 10;

function normalizeRequestedCustomerPlan(
  rawPlan: unknown
): 'oneTimeAccess' | 'monthlyAccess' | null {
  if (typeof rawPlan !== 'string') return null;
  const cleaned = rawPlan.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (cleaned === 'onetimeaccess' || cleaned === 'onetime' || cleaned === 'onetimeplan') {
    return 'oneTimeAccess';
  }
  if (cleaned === 'monthlyaccess' || cleaned === 'monthly' || cleaned === 'monthlyplan') {
    return 'monthlyAccess';
  }
  return null;
}

function buildAuthoritativePendingPlanView(
  productKey: 'oneTimeAccess' | 'monthlyAccess',
  expiresAtMs: number
): PublicPendingPlanView {
  const spec = AUTHORITATIVE_PRODUCT_PRICING[productKey];
  const isMonthly = productKey === 'monthlyAccess';
  return {
    productKey,
    productCode: isMonthly ? 'MONTHLY_ACCESS' : 'ONE_TIME_ACCESS',
    label: isMonthly ? 'Monthly Access' : 'One-Time Access',
    amountCents: spec.amountCents,
    amountUsd: spec.amountUsdString,
    formattedPrice: spec.formattedPrice,
    displayPrice: isMonthly ? '$12/month' : '$55',
    currency: 'USD',
    expiresAtMs,
  };
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function hashPasswordScrypt(password: string, saltHex: string): string {
  return crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function verifyPasswordScrypt(password: string, saltHex: string, expectedHashHex: string): boolean {
  try {
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().slice(0, 160);
}

function deriveCustomerUsername(account: { username?: unknown; email?: unknown }): string {
  if (typeof account.username === 'string' && account.username.trim().length > 0) {
    return account.username.trim().slice(0, 80);
  }
  const email = typeof account.email === 'string' ? account.email.trim() : '';
  const atIndex = email.indexOf('@');
  if (atIndex > 0) {
    return email.slice(0, atIndex).trim();
  }
  return email || 'User';
}

function isValidEmailFormat(email: string): boolean {
  if (!email || email.length < 5 || email.length > 160) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function validateStrongPassword(password: unknown): { valid: boolean; error?: string } {
  if (typeof password !== 'string') {
    return { valid: false, error: 'Please enter a password.' };
  }
  if (password.length < 8) {
    return {
      valid: false,
      error: 'Password must be at least 8 characters long.',
    };
  }
  if (password.length > 128) {
    return {
      valid: false,
      error: 'Password cannot exceed 128 characters.',
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must include at least one uppercase letter (A-Z).',
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: 'Password must include at least one lowercase letter (a-z).',
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: 'Password must include at least one number (0-9).',
    };
  }
  return { valid: true };
}

function createDefaultOneTimeEntitlement(): CustomerOneTimeEntitlement {
  return {
    status: 'INACTIVE',
    active: false,
    orderId: null,
    providerSid: null,
    amountCents: null,
    amountUsd: null,
    currency: 'USD',
    activatedAt: null,
    revokedAt: null,
    revocationReason: null,
  };
}

function createDefaultMonthlyEntitlement(): CustomerMonthlyEntitlement {
  return {
    status: 'INACTIVE',
    active: false,
    orderId: null,
    providerSid: null,
    amountCents: null,
    amountUsd: null,
    currency: 'USD',
    activatedAt: null,
    expiresAt: null,
    expiresAtMs: null,
    revokedAt: null,
    revocationReason: null,
  };
}

export class KycCustomerService {
  private readonly persistencePath: string;
  private state: PersistedCustomerState;
  private readonly sessions = new Map<string, CustomerSessionRecord>();
  private readonly pendingPlanIntents = new Map<string, CustomerPendingPlanIntentRecord>();
  private readonly authFailuresByIp = new Map<string, { count: number; windowStartMs: number }>();
  private readonly now: () => number;

  constructor(customPersistencePath?: string, nowFn?: () => number) {
    this.persistencePath = customPersistencePath || this.resolvePersistencePath();
    this.now = nowFn || (() => Date.now());
    this.state = this.loadOrInitializeState();
  }

  private resolvePersistencePath(): string {
    const customDir = (process.env.KYC_DATA_DIR || '').trim();
    if (customDir) {
      return path.resolve(customDir, 'kyc-customers-state.json');
    }
    if (process.env.VERCEL) {
      return path.join(os.tmpdir(), 'kyc-customers-state.json');
    }
    const localDataDir = path.resolve(process.cwd(), '.data');
    try {
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      fs.accessSync(localDataDir, fs.constants.W_OK);
      return path.join(localDataDir, 'kyc-customers-state.json');
    } catch {
      return path.join(os.tmpdir(), 'kyc-customers-state.json');
    }
  }

  private loadOrInitializeState(): PersistedCustomerState {
    const defaultState: PersistedCustomerState = { customers: [] };
    try {
      if (fs.existsSync(this.persistencePath)) {
        const raw = fs.readFileSync(this.persistencePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<PersistedCustomerState>;
        if (parsed && Array.isArray(parsed.customers)) {
          const normalizedCustomers: CustomerAccountRecord[] = parsed.customers
            .filter(
              (c): c is CustomerAccountRecord =>
                Boolean(
                  c &&
                    typeof c.customerId === 'string' &&
                    typeof c.email === 'string' &&
                    typeof c.passwordSalt === 'string' &&
                    typeof c.passwordHash === 'string'
                )
            )
            .map((c) => ({
              customerId: c.customerId,
              email: normalizeEmail(c.email),
              passwordSalt: c.passwordSalt,
              passwordHash: c.passwordHash,
              enabled: c.enabled !== false,
              createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
              updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : new Date().toISOString(),
              lastLoginAt: typeof c.lastLoginAt === 'string' ? c.lastLoginAt : null,
              oneTimeAccess: {
                ...createDefaultOneTimeEntitlement(),
                ...(c.oneTimeAccess || {}),
              },
              monthlyAccess: {
                ...createDefaultMonthlyEntitlement(),
                ...(c.monthlyAccess || {}),
              },
              appliedOrderIds: Array.isArray(c.appliedOrderIds)
                ? c.appliedOrderIds.filter((id): id is string => typeof id === 'string')
                : [],
            }));
          return { customers: normalizedCustomers };
        }
      }
    } catch {
      // Fallback to default empty state if file is missing or unreadable
    }
    this.saveState(defaultState);
    return defaultState;
  }

  private saveState(stateToSave: PersistedCustomerState = this.state): void {
    try {
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.persistencePath, JSON.stringify(stateToSave, null, 2), 'utf8');
    } catch {
      // Ignore write failures on read-only filesystems
    }
  }

  private refreshCustomerEntitlementExpirations(customer: CustomerAccountRecord): boolean {
    let changed = false;
    const nowMs = this.now();

    // Ensure oneTimeAccess consistency
    if (customer.oneTimeAccess.status === 'REVOKED' && customer.oneTimeAccess.active) {
      customer.oneTimeAccess.active = false;
      changed = true;
    } else if (customer.oneTimeAccess.status === 'ACTIVE' && !customer.oneTimeAccess.revokedAt) {
      if (!customer.oneTimeAccess.active) {
        customer.oneTimeAccess.active = true;
        changed = true;
      }
    }

    // Ensure monthlyAccess expiration is strictly enforced server-side
    if (customer.monthlyAccess.status === 'ACTIVE') {
      if (
        customer.monthlyAccess.revokedAt ||
        !customer.monthlyAccess.expiresAtMs ||
        nowMs >= customer.monthlyAccess.expiresAtMs
      ) {
        customer.monthlyAccess.status = customer.monthlyAccess.revokedAt ? 'REVOKED' : 'EXPIRED';
        customer.monthlyAccess.active = false;
        customer.updatedAt = new Date(nowMs).toISOString();
        changed = true;
      }
    } else if (customer.monthlyAccess.active) {
      customer.monthlyAccess.active = false;
      changed = true;
    }

    if (changed) {
      this.saveState();
    }
    return changed;
  }

  public toPublicCustomerView(customer: CustomerAccountRecord): PublicCustomerAccountView {
    this.refreshCustomerEntitlementExpirations(customer);

    const oneTimeActive =
      customer.oneTimeAccess.status === 'ACTIVE' &&
      customer.oneTimeAccess.active === true &&
      !customer.oneTimeAccess.revokedAt;

    const monthlyActive =
      customer.monthlyAccess.status === 'ACTIVE' &&
      customer.monthlyAccess.active === true &&
      !customer.monthlyAccess.revokedAt &&
      typeof customer.monthlyAccess.expiresAtMs === 'number' &&
      customer.monthlyAccess.expiresAtMs > this.now();

    const hasActivePaidAccess = oneTimeActive || monthlyActive;
    const activeAccessType: 'oneTimeAccess' | 'monthlyAccess' | 'none' = oneTimeActive
      ? 'oneTimeAccess'
      : monthlyActive
      ? 'monthlyAccess'
      : 'none';

    let oneTimeStatusLabel = 'Not Active';
    if (oneTimeActive) {
      oneTimeStatusLabel = 'Active — Permanent One-Time Access ($55 USD)';
    } else if (customer.oneTimeAccess.status === 'REVOKED') {
      oneTimeStatusLabel = 'Revoked / Refunded';
    }

    let monthlyStatusLabel = 'Not Active';
    if (monthlyActive && customer.monthlyAccess.expiresAt) {
      const expDate = new Date(customer.monthlyAccess.expiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      monthlyStatusLabel = `Active — Valid until ${expDate}`;
    } else if (customer.monthlyAccess.status === 'EXPIRED') {
      const expDate = customer.monthlyAccess.expiresAt
        ? new Date(customer.monthlyAccess.expiresAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : '';
      monthlyStatusLabel = expDate ? `Expired on ${expDate}` : 'Expired';
    } else if (customer.monthlyAccess.status === 'REVOKED') {
      monthlyStatusLabel = 'Revoked / Refunded';
    }

    let accessStatusLabel = 'Standard Account (No Active Plan)';
    if (oneTimeActive && monthlyActive) {
      accessStatusLabel = 'Active — One-Time Access ($55) & Monthly Access ($12/month)';
    } else if (oneTimeActive) {
      accessStatusLabel = 'Active — One-Time Access ($55)';
    } else if (monthlyActive) {
      accessStatusLabel = 'Active — Monthly Access ($12/month)';
    } else if (customer.monthlyAccess.status === 'EXPIRED') {
      accessStatusLabel = 'Expired — Monthly Access Plan Expired';
    }

    return {
      customerId: customer.customerId,
      username: deriveCustomerUsername(customer),
      email: customer.email,
      createdAt: customer.createdAt,
      lastLoginAt: customer.lastLoginAt,
      hasActivePaidAccess,
      activeAccessType,
      accessStatusLabel,
      oneTimeAccess: {
        status: customer.oneTimeAccess.status,
        active: oneTimeActive,
        statusLabel: oneTimeStatusLabel,
        priceLabel: '$55 USD (One-Time)',
        activatedAt: customer.oneTimeAccess.activatedAt,
        revokedAt: customer.oneTimeAccess.revokedAt,
        orderId: customer.oneTimeAccess.orderId,
      },
      monthlyAccess: {
        status: customer.monthlyAccess.status,
        active: monthlyActive,
        statusLabel: monthlyStatusLabel,
        priceLabel: '$12/month USD',
        activatedAt: customer.monthlyAccess.activatedAt,
        expiresAt: customer.monthlyAccess.expiresAt,
        expiresAtMs: customer.monthlyAccess.expiresAtMs,
        revokedAt: customer.monthlyAccess.revokedAt,
        orderId: customer.monthlyAccess.orderId,
      },
    };
  }

  private cleanupExpiredSessions(): void {
    const nowMs = this.now();
    for (const [tokenHash, session] of this.sessions.entries()) {
      if (nowMs >= session.expiresAtMs) {
        this.sessions.delete(tokenHash);
      }
    }
    for (const [intentHash, intent] of this.pendingPlanIntents.entries()) {
      if (nowMs >= intent.expiresAtMs) {
        this.pendingPlanIntents.delete(intentHash);
      }
    }
  }

  private isUntrustedCrossOriginMutation(req: Request): boolean {
    const customHeader = String(req.headers['x-kyc-customer-request'] || '').trim();
    if (customHeader === '1') {
      return false;
    }
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    if (!origin) return false;
    try {
      const originHost = new URL(origin).host.toLowerCase();
      const forwardedHost = String(req.headers['x-forwarded-host'] || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
      const directHost = String(req.headers.host || '').trim().toLowerCase();
      if (forwardedHost && originHost === forwardedHost) return false;
      if (directHost && originHost === directHost) return false;
      return true;
    } catch {
      return true;
    }
  }

  private extractRawCustomerToken(req: Request): string {
    const authHeader = (req.headers.authorization || '').trim();
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const candidate = authHeader.slice(7).trim();
      if (candidate.startsWith('kyccust_')) {
        return candidate;
      }
    }
    const headerToken = String(req.headers['x-kyc-customer-token'] || '').trim();
    if (headerToken.startsWith('kyccust_')) {
      return headerToken;
    }
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = (cookies[CUSTOMER_COOKIE_NAME] || '').trim();
    if (cookieToken.startsWith('kyccust_')) {
      return cookieToken;
    }
    return '';
  }

  private setCustomerSessionCookie(res: Response, rawToken: string): void {
    const maxAgeSec = Math.floor(CUSTOMER_SESSION_TTL_MS / 1000);
    res.append(
      'Set-Cookie',
      `${CUSTOMER_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }

  private clearCustomerSessionCookie(res: Response): void {
    res.append(
      'Set-Cookie',
      `${CUSTOMER_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }

  private extractRawPlanIntentToken(req: Request, body?: Record<string, unknown>): string {
    if (body && typeof body.planIntentToken === 'string') {
      const candidate = body.planIntentToken.trim();
      if (candidate.startsWith('kycplan_')) {
        return candidate;
      }
    }
    const headerToken = String(req.headers['x-kyc-plan-intent'] || '').trim();
    if (headerToken.startsWith('kycplan_')) {
      return headerToken;
    }
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = (cookies[CUSTOMER_PLAN_INTENT_COOKIE_NAME] || '').trim();
    if (cookieToken.startsWith('kycplan_')) {
      return cookieToken;
    }
    return '';
  }

  private setPlanIntentCookie(res: Response, rawIntentToken: string): void {
    const maxAgeSec = Math.floor(PLAN_INTENT_TTL_MS / 1000);
    res.append(
      'Set-Cookie',
      `${CUSTOMER_PLAN_INTENT_COOKIE_NAME}=${encodeURIComponent(rawIntentToken)}; Path=/; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }

  private clearPlanIntentCookie(res: Response): void {
    res.append(
      'Set-Cookie',
      `${CUSTOMER_PLAN_INTENT_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }

  private createPendingPlanIntent(productKey: 'oneTimeAccess' | 'monthlyAccess'): {
    rawIntentToken: string;
    intent: CustomerPendingPlanIntentRecord;
    publicPlan: PublicPendingPlanView;
  } {
    this.cleanupExpiredSessions();
    const rawIntentToken = `kycplan_${crypto.randomUUID()}_${crypto.randomBytes(18).toString('hex')}`;
    const tokenHash = sha256Hex(rawIntentToken);
    const nowMs = this.now();
    const expiresAtMs = nowMs + PLAN_INTENT_TTL_MS;
    const publicPlan = buildAuthoritativePendingPlanView(productKey, expiresAtMs);
    const intent: CustomerPendingPlanIntentRecord = {
      ...publicPlan,
      intentId: `PINT-${crypto.randomUUID()}`,
      tokenHash,
      createdAtMs: nowMs,
    };
    this.pendingPlanIntents.set(tokenHash, intent);
    return { rawIntentToken, intent, publicPlan };
  }

  public resolvePendingPlanIntent(
    req: Request,
    body?: Record<string, unknown>,
    consume = false
  ): PublicPendingPlanView | null {
    this.cleanupExpiredSessions();
    const rawToken = this.extractRawPlanIntentToken(req, body);
    let record: CustomerPendingPlanIntentRecord | undefined;
    let tokenHash = '';
    if (rawToken) {
      tokenHash = sha256Hex(rawToken);
      record = this.pendingPlanIntents.get(tokenHash);
    }
    if (!record && body && typeof body.pendingPlan !== 'undefined') {
      const fallbackPlanKey = normalizeRequestedCustomerPlan(body.pendingPlan);
      if (fallbackPlanKey) {
        return buildAuthoritativePendingPlanView(fallbackPlanKey, this.now() + PLAN_INTENT_TTL_MS);
      }
    }
    if (!record) return null;
    if (this.now() >= record.expiresAtMs) {
      this.pendingPlanIntents.delete(tokenHash);
      return null;
    }
    if (consume && tokenHash) {
      this.pendingPlanIntents.delete(tokenHash);
    }
    return {
      productKey: record.productKey,
      productCode: record.productCode,
      label: record.label,
      amountCents: record.amountCents,
      amountUsd: record.amountUsd,
      formattedPrice: record.formattedPrice,
      displayPrice: record.displayPrice,
      currency: record.currency,
      expiresAtMs: record.expiresAtMs,
    };
  }

  public resolveAuthenticatedCustomer(req: Request): {
    authenticated: boolean;
    customer: CustomerAccountRecord | null;
    session: CustomerSessionRecord | null;
    publicView: PublicCustomerAccountView | null;
  } {
    this.cleanupExpiredSessions();
    const rawToken = this.extractRawCustomerToken(req);
    if (!rawToken || !rawToken.startsWith('kyccust_')) {
      return { authenticated: false, customer: null, session: null, publicView: null };
    }
    const tokenHash = sha256Hex(rawToken);
    const session = this.sessions.get(tokenHash);
    if (!session) {
      return { authenticated: false, customer: null, session: null, publicView: null };
    }
    const nowMs = this.now();
    if (nowMs >= session.expiresAtMs) {
      this.sessions.delete(tokenHash);
      return { authenticated: false, customer: null, session: null, publicView: null };
    }
    const customer = this.state.customers.find(
      (c) => c.customerId === session.customerId && c.enabled !== false
    );
    if (!customer) {
      this.sessions.delete(tokenHash);
      return { authenticated: false, customer: null, session: null, publicView: null };
    }
    session.lastActiveAtMs = nowMs;
    const publicView = this.toPublicCustomerView(customer);
    return {
      authenticated: true,
      customer,
      session,
      publicView,
    };
  }

  public resolveAuthenticatedCustomerId(req: Request): string | null {
    const resolved = this.resolveAuthenticatedCustomer(req);
    return resolved.authenticated && resolved.customer ? resolved.customer.customerId : null;
  }

  public toClientEntitlementsPayload(publicView: PublicCustomerAccountView) {
    const otStatus =
      publicView.oneTimeAccess.active
        ? 'active'
        : publicView.oneTimeAccess.status === 'REVOKED'
        ? 'revoked'
        : 'none';
    const moStatus =
      publicView.monthlyAccess.active
        ? 'active'
        : publicView.monthlyAccess.status === 'EXPIRED'
        ? 'expired'
        : publicView.monthlyAccess.status === 'REVOKED'
        ? 'revoked'
        : 'none';
    return {
      hasActivePaidAccess: publicView.hasActivePaidAccess,
      activeAccessType: publicView.activeAccessType,
      currentAccessStatus: publicView.accessStatusLabel,
      oneTimeAccess: {
        ...publicView.oneTimeAccess,
        status: otStatus,
        paidAt: publicView.oneTimeAccess.activatedAt,
      },
      monthlyAccess: {
        ...publicView.monthlyAccess,
        status: moStatus,
        paidAt: publicView.monthlyAccess.activatedAt,
      },
    };
  }

  /**
   * Evaluates whether the request comes from an authenticated customer with active server-verified
   * One-Time Access ($55) or active, non-expired Monthly Access ($12/month).
   */
  public evaluateCustomerPaidAccess(req: Request): {
    authorized: boolean;
    customerId: string | null;
    email: string | null;
    activePlan: 'oneTimeAccess' | 'monthlyAccess' | null;
    label: string | null;
    formattedPrice: string | null;
    orderId: string | null;
    sid: string | null;
    expiresAtMs: number;
  } {
    const resolved = this.resolveAuthenticatedCustomer(req);
    if (!resolved.authenticated || !resolved.customer || !resolved.publicView) {
      return {
        authorized: false,
        customerId: null,
        email: null,
        activePlan: null,
        label: null,
        formattedPrice: null,
        orderId: null,
        sid: null,
        expiresAtMs: 0,
      };
    }

    const { customer, publicView } = resolved;
    if (publicView.oneTimeAccess.active) {
      return {
        authorized: true,
        customerId: customer.customerId,
        email: customer.email,
        activePlan: 'oneTimeAccess',
        label: 'One-Time Access',
        formattedPrice: '$55.00',
        orderId: customer.oneTimeAccess.orderId,
        sid: customer.oneTimeAccess.providerSid,
        // Permanent access (represented as 10 years ahead for client TTL checks while validated on every request)
        expiresAtMs: this.now() + 3650 * 24 * 60 * 60 * 1000,
      };
    }

    if (
      publicView.monthlyAccess.active &&
      customer.monthlyAccess.expiresAtMs &&
      customer.monthlyAccess.expiresAtMs > this.now()
    ) {
      return {
        authorized: true,
        customerId: customer.customerId,
        email: customer.email,
        activePlan: 'monthlyAccess',
        label: 'Monthly Access',
        formattedPrice: '$12.00',
        orderId: customer.monthlyAccess.orderId,
        sid: customer.monthlyAccess.providerSid,
        expiresAtMs: customer.monthlyAccess.expiresAtMs,
      };
    }

    return {
      authorized: false,
      customerId: customer.customerId,
      email: customer.email,
      activePlan: null,
      label: null,
      formattedPrice: null,
      orderId: null,
      sid: null,
      expiresAtMs: 0,
    };
  }

  /**
   * Grants One-Time Access ($55.00 USD) or Monthly Access ($12.00 USD) to a customer account
   * ONLY after strict server-side Sifalo Pay payment verification.
   */
  public grantVerifiedSifaloOrderToCustomer(
    order: SifaloOrderRecord,
    fallbackCustomerId?: string | null
  ): PublicCustomerAccountView | null {
    if (!order || order.status !== 'PAID' || order.revokedAt) {
      return null;
    }
    if (!order.providerSid || !order.providerSid.trim()) {
      return null;
    }
    if (order.currency !== 'USD') {
      return null;
    }
    if (order.productKey !== 'oneTimeAccess' && order.productKey !== 'monthlyAccess') {
      return null;
    }

    const expectedSpec = AUTHORITATIVE_PRODUCT_PRICING[order.productKey];
    if (!expectedSpec || order.amountCents !== expectedSpec.amountCents) {
      return null;
    }

    const targetCustomerId = (order.customerId || fallbackCustomerId || '').trim();
    if (!targetCustomerId) {
      return null;
    }

    const customer = this.state.customers.find(
      (c) => c.customerId === targetCustomerId && c.enabled !== false
    );
    if (!customer) {
      return null;
    }

    const nowMs = this.now();
    const nowIso = new Date(nowMs).toISOString();

    if (!Array.isArray(customer.appliedOrderIds)) {
      customer.appliedOrderIds = [];
    }

    // Bind order to customer so future refunds/reversals can also locate it
    if (!order.customerId) {
      order.customerId = customer.customerId;
    }

    // Prevent duplicate application of the same verified order
    if (customer.appliedOrderIds.includes(order.orderId)) {
      return this.toPublicCustomerView(customer);
    }

    if (order.productKey === 'oneTimeAccess') {
      customer.oneTimeAccess = {
        status: 'ACTIVE',
        active: true,
        orderId: order.orderId,
        providerSid: order.providerSid,
        amountCents: order.amountCents,
        amountUsd: order.amountUsdString,
        currency: 'USD',
        activatedAt: nowIso,
        revokedAt: null,
        revocationReason: null,
      };
    } else if (order.productKey === 'monthlyAccess') {
      this.refreshCustomerEntitlementExpirations(customer);
      const baseTimeMs =
        customer.monthlyAccess.status === 'ACTIVE' &&
        customer.monthlyAccess.active &&
        customer.monthlyAccess.expiresAtMs &&
        customer.monthlyAccess.expiresAtMs > nowMs
          ? customer.monthlyAccess.expiresAtMs
          : nowMs;
      const nextExpiresAtMs = baseTimeMs + MONTHLY_ACCESS_DURATION_MS;
      customer.monthlyAccess = {
        status: 'ACTIVE',
        active: true,
        orderId: order.orderId,
        providerSid: order.providerSid,
        amountCents: order.amountCents,
        amountUsd: order.amountUsdString,
        currency: 'USD',
        activatedAt: nowIso,
        expiresAt: new Date(nextExpiresAtMs).toISOString(),
        expiresAtMs: nextExpiresAtMs,
        revokedAt: null,
        revocationReason: null,
      };
    }

    customer.appliedOrderIds.push(order.orderId);
    customer.updatedAt = nowIso;
    this.saveState();
    return this.toPublicCustomerView(customer);
  }

  /**
   * Revokes customer entitlement if a Sifalo Pay transaction for One-Time Access or Monthly Access
   * is later refunded or reversed.
   */
  public revokeSifaloOrderEntitlement(order: SifaloOrderRecord, reason: string): void {
    if (!order || (order.productKey !== 'oneTimeAccess' && order.productKey !== 'monthlyAccess')) {
      return;
    }
    const nowIso = new Date(this.now()).toISOString();
    let changed = false;

    for (const customer of this.state.customers) {
      if (
        order.productKey === 'oneTimeAccess' &&
        customer.oneTimeAccess.orderId === order.orderId
      ) {
        customer.oneTimeAccess.status = 'REVOKED';
        customer.oneTimeAccess.active = false;
        customer.oneTimeAccess.revokedAt = nowIso;
        customer.oneTimeAccess.revocationReason = reason;
        customer.updatedAt = nowIso;
        changed = true;
      } else if (
        order.productKey === 'monthlyAccess' &&
        customer.monthlyAccess.orderId === order.orderId
      ) {
        customer.monthlyAccess.status = 'REVOKED';
        customer.monthlyAccess.active = false;
        customer.monthlyAccess.revokedAt = nowIso;
        customer.monthlyAccess.revocationReason = reason;
        customer.updatedAt = nowIso;
        changed = true;
      }
    }

    if (changed) {
      this.saveState();
    }
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
  }

  private isRateLimited(ip: string): boolean {
    const entry = this.authFailuresByIp.get(ip);
    if (!entry) return false;
    if (this.now() - entry.windowStartMs > RATE_LIMIT_WINDOW_MS) {
      this.authFailuresByIp.delete(ip);
      return false;
    }
    return entry.count >= MAX_AUTH_FAILURES_PER_WINDOW;
  }

  private recordAuthFailure(ip: string): void {
    const nowMs = this.now();
    const existing = this.authFailuresByIp.get(ip);
    if (!existing || nowMs - existing.windowStartMs > RATE_LIMIT_WINDOW_MS) {
      this.authFailuresByIp.set(ip, { count: 1, windowStartMs: nowMs });
    } else {
      existing.count += 1;
    }
  }

  private clearAuthFailures(ip: string): void {
    this.authFailuresByIp.delete(ip);
  }

  private createCustomerSession(customer: CustomerAccountRecord): {
    rawToken: string;
    session: CustomerSessionRecord;
  } {
    this.cleanupExpiredSessions();
    const rawToken = `kyccust_${crypto.randomUUID()}_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = sha256Hex(rawToken);
    const nowMs = this.now();
    const session: CustomerSessionRecord = {
      sessionId: `CSESS-${crypto.randomUUID()}`,
      tokenHash,
      customerId: customer.customerId,
      email: customer.email,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + CUSTOMER_SESSION_TTL_MS,
      lastActiveAtMs: nowMs,
    };
    this.sessions.set(tokenHash, session);
    return { rawToken, session };
  }

  public createCustomerRouter(): express.Router {
    const router = express.Router();

    router.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });

    router.get('/auth/status', (req: Request, res: Response) => {
      const resolved = this.resolveAuthenticatedCustomer(req);
      const pendingPlan = this.resolvePendingPlanIntent(req, undefined, false);
      if (!resolved.authenticated || !resolved.publicView || !resolved.session) {
        return res.status(200).json({
          ok: true,
          authenticated: false,
          customer: null,
          entitlements: null,
          pendingCheckoutPlan: pendingPlan,
        });
      }
      return res.status(200).json({
        ok: true,
        authenticated: true,
        customer: {
          ...resolved.publicView,
          id: resolved.publicView.customerId,
        },
        entitlements: this.toClientEntitlementsPayload(resolved.publicView),
        pendingCheckoutPlan: pendingPlan,
        sessionExpiresAt: new Date(resolved.session.expiresAtMs).toISOString(),
      });
    });

    router.get('/checkout-intent', (req: Request, res: Response) => {
      const pendingPlan = this.resolvePendingPlanIntent(req, undefined, false);
      const resolved = this.resolveAuthenticatedCustomer(req);
      return res.status(200).json({
        ok: true,
        authenticated: resolved.authenticated,
        pendingCheckoutPlan: pendingPlan,
      });
    });

    router.post('/checkout-intent', (req: Request, res: Response) => {
      if (this.isUntrustedCrossOriginMutation(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Cross-origin checkout intent request rejected.',
        });
      }
      const body =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const productKey = normalizeRequestedCustomerPlan(
        body.plan || body.productKey || body.productCode
      );
      if (!productKey) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid access plan selected. Please choose One-Time Access ($55) or Monthly Access ($12/month).',
        });
      }

      // Remove any older intent token from this client before creating the new one
      const prevRaw = this.extractRawPlanIntentToken(req, body);
      if (prevRaw) {
        this.pendingPlanIntents.delete(sha256Hex(prevRaw));
      }

      const { rawIntentToken, publicPlan } = this.createPendingPlanIntent(productKey);
      this.setPlanIntentCookie(res, rawIntentToken);
      const resolved = this.resolveAuthenticatedCustomer(req);

      return res.status(200).json({
        ok: true,
        authenticated: resolved.authenticated,
        planIntentToken: rawIntentToken,
        pendingCheckoutPlan: publicPlan,
      });
    });

    router.delete('/checkout-intent', (req: Request, res: Response) => {
      if (this.isUntrustedCrossOriginMutation(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Cross-origin request rejected.',
        });
      }
      const prevRaw = this.extractRawPlanIntentToken(req);
      if (prevRaw) {
        this.pendingPlanIntents.delete(sha256Hex(prevRaw));
      }
      this.clearPlanIntentCookie(res);
      return res.status(200).json({
        ok: true,
        pendingCheckoutPlan: null,
      });
    });

    router.post('/auth/register', (req: Request, res: Response) => {
      if (this.isUntrustedCrossOriginMutation(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Cross-origin registration request rejected.',
        });
      }

      const clientIp = this.getClientIp(req);
      if (this.isRateLimited(clientIp)) {
        return res.status(429).json({
          ok: false,
          error: 'Too many authentication attempts. Please wait 10 minutes and try again.',
        });
      }

      const body =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const email = normalizeEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

      if (!isValidEmailFormat(email)) {
        return res.status(400).json({
          ok: false,
          error: 'Please enter a valid email address.',
        });
      }

      const pwCheck = validateStrongPassword(password);
      if (!pwCheck.valid) {
        return res.status(400).json({
          ok: false,
          error: pwCheck.error || 'Please choose a stronger password.',
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          ok: false,
          error: 'Passwords do not match. Please confirm your password.',
        });
      }

      const duplicate = this.state.customers.some(
        (c) => c.email.toLowerCase() === email.toLowerCase()
      );
      if (duplicate) {
        this.recordAuthFailure(clientIp);
        return res.status(409).json({
          ok: false,
          error: 'An account with this email address already exists. Please log in instead.',
        });
      }

      const nowIso = new Date(this.now()).toISOString();
      const saltHex = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPasswordScrypt(password, saltHex);

      const newCustomer: CustomerAccountRecord = {
        customerId: `CUST-${crypto.randomUUID()}`,
        username: deriveCustomerUsername({ username: body.username, email }),
        email,
        passwordSalt: saltHex,
        passwordHash,
        enabled: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
        oneTimeAccess: createDefaultOneTimeEntitlement(),
        monthlyAccess: createDefaultMonthlyEntitlement(),
        appliedOrderIds: [],
      };

      this.state.customers.push(newCustomer);
      this.saveState();
      this.clearAuthFailures(clientIp);

      const { rawToken, session } = this.createCustomerSession(newCustomer);
      this.setCustomerSessionCookie(res, rawToken);
      const pendingCheckoutPlan = this.resolvePendingPlanIntent(req, body, true);
      if (pendingCheckoutPlan) {
        this.clearPlanIntentCookie(res);
      }
      const publicView = this.toPublicCustomerView(newCustomer);

      return res.status(201).json({
        ok: true,
        authenticated: true,
        token: rawToken,
        sessionToken: rawToken,
        customer: {
          ...publicView,
          id: publicView.customerId,
        },
        entitlements: this.toClientEntitlementsPayload(publicView),
        pendingCheckoutPlan,
        sessionExpiresAt: new Date(session.expiresAtMs).toISOString(),
      });
    });

    router.post('/auth/login', (req: Request, res: Response) => {
      if (this.isUntrustedCrossOriginMutation(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Cross-origin login request rejected.',
        });
      }

      const clientIp = this.getClientIp(req);
      if (this.isRateLimited(clientIp)) {
        return res.status(429).json({
          ok: false,
          error: 'Too many failed login attempts. Please wait 10 minutes before trying again.',
        });
      }

      const body =
        req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const email = normalizeEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';

      if (!isValidEmailFormat(email) || !password) {
        return res.status(400).json({
          ok: false,
          error: 'Please enter your email address and password.',
        });
      }

      const customer = this.state.customers.find(
        (c) => c.email.toLowerCase() === email.toLowerCase()
      );
      if (!customer || !verifyPasswordScrypt(password, customer.passwordSalt, customer.passwordHash)) {
        this.recordAuthFailure(clientIp);
        return res.status(401).json({
          ok: false,
          error: 'Invalid email address or password.',
        });
      }

      if (!customer.enabled) {
        return res.status(403).json({
          ok: false,
          error: 'This customer account is currently disabled. Please contact support.',
        });
      }

      this.clearAuthFailures(clientIp);
      const nowIso = new Date(this.now()).toISOString();
      customer.lastLoginAt = nowIso;
      customer.updatedAt = nowIso;
      this.saveState();

      const { rawToken, session } = this.createCustomerSession(customer);
      this.setCustomerSessionCookie(res, rawToken);
      const pendingCheckoutPlan = this.resolvePendingPlanIntent(req, body, true);
      if (pendingCheckoutPlan) {
        this.clearPlanIntentCookie(res);
      }
      const publicView = this.toPublicCustomerView(customer);

      return res.status(200).json({
        ok: true,
        authenticated: true,
        token: rawToken,
        sessionToken: rawToken,
        customer: {
          ...publicView,
          id: publicView.customerId,
        },
        entitlements: this.toClientEntitlementsPayload(publicView),
        pendingCheckoutPlan,
        sessionExpiresAt: new Date(session.expiresAtMs).toISOString(),
      });
    });

    router.post('/auth/logout', (req: Request, res: Response) => {
      if (this.isUntrustedCrossOriginMutation(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Cross-origin logout request rejected.',
        });
      }
      const rawToken = this.extractRawCustomerToken(req);
      if (rawToken) {
        const tokenHash = sha256Hex(rawToken);
        this.sessions.delete(tokenHash);
      }
      this.clearCustomerSessionCookie(res);
      return res.status(200).json({
        ok: true,
        authenticated: false,
      });
    });

    return router;
  }
}
