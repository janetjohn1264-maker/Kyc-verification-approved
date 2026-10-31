import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, '.data');
const STORE_FILE = path.join(DATA_DIR, 'ogads-store.json');

export interface OgadsConfig {
  trackingLink: string;
  publisherId: string;
  lockerId: string;
  postbackSecret: string;
  apiKey: string;
  allowedPostbackIps: string;
  minPayout: number;
  unlockDurationMinutes: number;
  adminPasswordHash: string;
  adminPasswordSalt: string;
  updatedAt: string;
}

export interface LockRecord {
  lockId: string;
  sessionId: string;
  fileId: string;
  fileName: string;
  docTitle: string;
  country: string;
  docType: string;
  staticAssetPath: string | null;
  status: 'locked' | 'awaiting_offer' | 'unlocked' | 'expired';
  trackingUrl: string;
  clicksCount: number;
  createdAt: number;
  lastClickedAt: number | null;
  unlockedAt: number | null;
  expiresAt: number | null;
  downloadAuthToken: string | null;
  downloadCount: number;
  lastDownloadedAt: number | null;
  conversionId: string | null;
  offerId: string | null;
  offerName: string | null;
  payout: number | null;
  visitorIp: string;
}

export interface ConversionRecord {
  conversionId: string;
  dedupKey: string;
  lockId: string;
  sessionId: string;
  fileId: string;
  fileName: string;
  docTitle: string;
  offerId: string;
  offerName: string;
  payout: number;
  sessionIp: string;
  postbackIp: string;
  verifiedAt: number;
  rawDate: string;
}

export interface OgadsStore {
  config: OgadsConfig;
  stats: {
    totalConversions: number;
    totalUnlockedDownloads: number;
    totalLockRequests: number;
    totalOfferClicks: number;
  };
  locks: Record<string, LockRecord>;
  conversions: ConversionRecord[];
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function createDefaultStore(): OgadsStore {
  const envAdminPass = process.env.OGADS_ADMIN_PASSWORD || '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = envAdminPass ? hashPassword(envAdminPass, salt) : '';

  return {
    config: {
      trackingLink: process.env.OGADS_TRACKING_LINK || 'https://trkoffer.net/cl/i/n616e4',
      publisherId: process.env.OGADS_PUBLISHER_ID || '',
      lockerId: process.env.OGADS_LOCKER_ID || 'n616e4',
      postbackSecret: process.env.OGADS_POSTBACK_SECRET || '',
      apiKey: process.env.OGADS_API_KEY || '',
      allowedPostbackIps: process.env.OGADS_ALLOWED_IPS || '',
      minPayout: Number(process.env.OGADS_MIN_PAYOUT) || 0,
      unlockDurationMinutes: Number(process.env.OGADS_UNLOCK_DURATION_MINUTES) || 60,
      adminPasswordHash: hash,
      adminPasswordSalt: salt,
      updatedAt: new Date().toISOString(),
    },
    stats: {
      totalConversions: 0,
      totalUnlockedDownloads: 0,
      totalLockRequests: 0,
      totalOfferClicks: 0,
    },
    locks: {},
    conversions: [],
  };
}

let store: OgadsStore = createDefaultStore();

function loadStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<OgadsStore>;
      const def = createDefaultStore();
      store = {
        config: {
          ...def.config,
          ...(parsed.config || {}),
          trackingLink: parsed.config?.trackingLink || def.config.trackingLink || 'https://trkoffer.net/cl/i/n616e4',
        },
        stats: {
          ...def.stats,
          ...(parsed.stats || {}),
        },
        locks: parsed.locks || {},
        conversions: Array.isArray(parsed.conversions) ? parsed.conversions : [],
      };
      // Sync environment overrides if set
      if (process.env.OGADS_POSTBACK_SECRET && !store.config.postbackSecret) {
        store.config.postbackSecret = process.env.OGADS_POSTBACK_SECRET;
      }
      if (process.env.OGADS_PUBLISHER_ID && !store.config.publisherId) {
        store.config.publisherId = process.env.OGADS_PUBLISHER_ID;
      }
      if (process.env.OGADS_API_KEY && !store.config.apiKey) {
        store.config.apiKey = process.env.OGADS_API_KEY;
      }
    } else {
      saveStore();
    }
  } catch (err) {
    console.error('Failed to load OGAds store, using defaults:', err);
  }
}

function saveStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist OGAds store:', err);
  }
}

loadStore();

// Active admin sessions in memory (token -> expiry timestamp)
const adminSessions = new Map<string, number>();
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      try {
        result[k] = decodeURIComponent(v);
      } catch {
        result[k] = v;
      }
    }
  });
  return result;
}

function getOrCreateVisitorSession(req: Request, res: Response): string {
  const cookies = parseCookies(req.headers.cookie);
  const headerSid = typeof req.headers['x-visitor-session'] === 'string' ? req.headers['x-visitor-session'].trim() : '';
  const bodySid = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  const querySid = typeof req.query?.sessionId === 'string' ? req.query.sessionId.trim() : '';
  let sid = bodySid || querySid || headerSid || cookies['kyc_visitor_sid'];
  if (!sid || !/^[a-zA-Z0-9_-]{12,80}$/.test(sid)) {
    sid = 'vs_' + crypto.randomBytes(20).toString('hex');
  }
  res.setHeader(
    'Set-Cookie',
    `kyc_visitor_sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
  return sid;
}

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '0.0.0.0';
}

function getVerificationStatus() {
  const missing: string[] = [];
  if (!store.config.trackingLink || !store.config.trackingLink.startsWith('http')) {
    missing.push('Valid OGAds Tracking Link URL is required.');
  }
  if (!store.config.publisherId.trim()) {
    missing.push('OGAds Publisher ID is not configured in the Admin Dashboard.');
  }
  if (!store.config.postbackSecret.trim()) {
    missing.push('OGAds Server-to-Server (S2S) Postback Secret Key is not configured.');
  }
  return {
    offerwallConfigured: Boolean(store.config.trackingLink && store.config.trackingLink.startsWith('http')),
    verificationConfigured: missing.length === 0,
    missingConfigReasons: missing,
  };
}

function buildOgadsTrackingUrl(baseUrl: string, lockId: string, fileId: string, sessionId: string, country: string): string {
  try {
    const url = new URL(baseUrl || 'https://trkoffer.net/cl/i/n616e4');
    url.searchParams.set('aff_sub', lockId);
    url.searchParams.set('aff_sub2', fileId.slice(0, 64));
    url.searchParams.set('aff_sub3', sessionId.slice(0, 24));
    url.searchParams.set('aff_sub4', (country || 'global').slice(0, 32));
    return url.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}aff_sub=${encodeURIComponent(lockId)}&aff_sub2=${encodeURIComponent(fileId)}&aff_sub3=${encodeURIComponent(sessionId.slice(0, 24))}&aff_sub4=${encodeURIComponent(country || 'global')}`;
  }
}

function refreshLockExpiration(lock: LockRecord): void {
  if (lock.status === 'unlocked' && lock.expiresAt && Date.now() > lock.expiresAt) {
    lock.status = 'expired';
    lock.downloadAuthToken = null;
  }
}

function extractAdminToken(req: Request): string {
  const headerToken = typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'].trim() : '';
  if (headerToken) return headerToken;
  const authHeader = typeof req.headers['authorization'] === 'string' ? req.headers['authorization'].trim() : '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractAdminToken(req);
  if (!token || !adminSessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized: Valid Admin session required.' });
    return;
  }
  const exp = adminSessions.get(token)!;
  if (Date.now() > exp) {
    adminSessions.delete(token);
    res.status(401).json({ error: 'Admin session expired. Please sign in again.' });
    return;
  }
  next();
}

const PROTECTED_STATIC_ASSETS: Record<string, { fileId: string; fileName: string }> = {
  '/assets/aistudio/proof_of_account.pdf': {
    fileId: 'proof-of-account-pdf',
    fileName: 'proof_of_account.pdf',
  },
  '/assets/aistudio/proof_of_account__1__3c9d9253.pdf': {
    fileId: 'proof-of-account-pdf',
    fileName: 'proof_of_account__1__3c9d9253.pdf',
  },
};

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Protect direct PDF file downloads unless authorized with a valid unlock token
  app.use((req: Request, res: Response, next: NextFunction) => {
    const cleanPath = req.path;
    if (PROTECTED_STATIC_ASSETS[cleanPath]) {
      const token = (req.query.token as string) || '';
      const lockId = (req.query.lockId as string) || '';
      const lock = lockId ? store.locks[lockId] : undefined;
      if (lock) {
        refreshLockExpiration(lock);
      }
      if (!lock || lock.status !== 'unlocked' || !lock.downloadAuthToken || !safeEqual(lock.downloadAuthToken, token)) {
        res.status(403).json({
          error: 'Download Locked',
          message: 'Direct access to this verification document is protected by the OGAds Content Locker. Please complete an eligible offer on the verification portal to unlock this download.',
          trackingLink: store.config.trackingLink,
        });
        return;
      }
    }
    next();
  });

  // 1. Public Configuration & Session State
  app.get('/api/ogads/public-config', (req: Request, res: Response) => {
    const sessionId = getOrCreateVisitorSession(req, res);
    const verStatus = getVerificationStatus();

    const unlockedFiles: Record<string, {
      lockId: string;
      fileId: string;
      fileName: string;
      docTitle: string;
      unlockedAt: number;
      expiresAt: number;
      remainingSeconds: number;
      downloadAuthToken: string;
    }> = {};

    const activeLocks: Record<string, {
      lockId: string;
      fileId: string;
      status: string;
      trackingUrl: string;
    }> = {};

    Object.values(store.locks).forEach((lock) => {
      if (lock.sessionId === sessionId) {
        refreshLockExpiration(lock);
        if (lock.status === 'unlocked' && lock.downloadAuthToken && lock.expiresAt) {
          unlockedFiles[lock.fileId] = {
            lockId: lock.lockId,
            fileId: lock.fileId,
            fileName: lock.fileName,
            docTitle: lock.docTitle,
            unlockedAt: lock.unlockedAt || Date.now(),
            expiresAt: lock.expiresAt,
            remainingSeconds: Math.max(0, Math.floor((lock.expiresAt - Date.now()) / 1000)),
            downloadAuthToken: lock.downloadAuthToken,
          };
        } else if (lock.status === 'locked' || lock.status === 'awaiting_offer') {
          activeLocks[lock.fileId] = {
            lockId: lock.lockId,
            fileId: lock.fileId,
            status: lock.status,
            trackingUrl: lock.trackingUrl,
          };
        }
      }
    });

    res.json({
      ok: true,
      sessionId,
      trackingLink: store.config.trackingLink || 'https://trkoffer.net/cl/i/n616e4',
      lockerId: store.config.lockerId || 'n616e4',
      publisherConfigured: Boolean(store.config.publisherId.trim()),
      publisherIdConfigured: Boolean(store.config.publisherId.trim()),
      offerwallConfigured: verStatus.offerwallConfigured,
      verificationConfigured: verStatus.verificationConfigured,
      missingConfigReasons: verStatus.missingConfigReasons,
      unlockDurationMinutes: store.config.unlockDurationMinutes,
      unlockedFiles,
      activeLocks,
    });
  });

  const DEFAULT_STATIC_ASSET_BY_FILE_ID: Record<string, string> = {
    'proof-of-account-pdf': '/assets/aistudio/proof_of_account.pdf',
    'pakistan-specimen-jpg': '/assets/aistudio/pakistan_cnic_specimen.jpg',
    'drcongo-reference-jpg': '/assets/aistudio/drc_passport_reference.jpg',
  };

  // 2. Create or Retrieve a File Lock Session for a Visitor
  app.post('/api/ogads/lock-session', (req: Request, res: Response) => {
    const sessionId = getOrCreateVisitorSession(req, res);
    const rawFileId = typeof req.body?.fileId === 'string' ? req.body.fileId.trim() : '';
    const rawFileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
    const rawDocTitle = typeof req.body?.docTitle === 'string' ? req.body.docTitle.trim() : '';
    const rawCountry = typeof req.body?.country === 'string' ? req.body.country.trim() : 'global';
    const rawDocType = typeof req.body?.docType === 'string' ? req.body.docType.trim() : 'document';
    const rawStaticAsset =
      typeof req.body?.staticAssetPath === 'string' && req.body.staticAssetPath.trim()
        ? req.body.staticAssetPath.trim()
        : DEFAULT_STATIC_ASSET_BY_FILE_ID[rawFileId] || null;

    if (!rawFileId || !/^[a-zA-Z0-9_.-]{2,80}$/.test(rawFileId)) {
      res.status(400).json({ error: 'Invalid fileId parameter.' });
      return;
    }

    const fileId = rawFileId;
    const fileName = rawFileName || `${fileId}.png`;
    const docTitle = rawDocTitle || fileName;

    // Check if an active lock already exists for this visitor + fileId
    let existingLock = Object.values(store.locks).find(
      (l) => l.sessionId === sessionId && l.fileId === fileId
    );

    if (existingLock) {
      refreshLockExpiration(existingLock);
    }

    // If expired, create a fresh lock so the visitor gets a clean tracking subId
    if (!existingLock || existingLock.status === 'expired') {
      const lockId = 'lck_' + crypto.randomBytes(10).toString('hex');
      const trackingUrl = buildOgadsTrackingUrl(
        store.config.trackingLink || 'https://trkoffer.net/cl/i/n616e4',
        lockId,
        fileId,
        sessionId,
        rawCountry
      );

      existingLock = {
        lockId,
        sessionId,
        fileId,
        fileName,
        docTitle,
        country: rawCountry,
        docType: rawDocType,
        staticAssetPath: rawStaticAsset,
        status: 'locked',
        trackingUrl,
        clicksCount: 0,
        createdAt: Date.now(),
        lastClickedAt: null,
        unlockedAt: null,
        expiresAt: null,
        downloadAuthToken: null,
        downloadCount: 0,
        lastDownloadedAt: null,
        conversionId: null,
        offerId: null,
        offerName: null,
        payout: null,
        visitorIp: getClientIp(req),
      };

      store.locks[lockId] = existingLock;
      store.stats.totalLockRequests += 1;
      saveStore();
    } else {
      // Keep tracking URL synced with current admin trackingLink
      existingLock.trackingUrl = buildOgadsTrackingUrl(
        store.config.trackingLink || 'https://trkoffer.net/cl/i/n616e4',
        existingLock.lockId,
        existingLock.fileId,
        existingLock.sessionId,
        existingLock.country
      );
      existingLock.fileName = fileName;
      existingLock.docTitle = docTitle;
      if (rawStaticAsset) existingLock.staticAssetPath = rawStaticAsset;
      saveStore();
    }

    const verStatus = getVerificationStatus();

    res.json({
      ok: true,
      lockId: existingLock.lockId,
      sessionId,
      fileId: existingLock.fileId,
      fileName: existingLock.fileName,
      docTitle: existingLock.docTitle,
      country: existingLock.country,
      docType: existingLock.docType,
      status: existingLock.status,
      unlocked: existingLock.status === 'unlocked',
      offerName: existingLock.offerName,
      trackingUrl: existingLock.trackingUrl,
      trackingLinkBase: store.config.trackingLink || 'https://trkoffer.net/cl/i/n616e4',
      unlockedAt: existingLock.unlockedAt,
      expiresAt: existingLock.expiresAt,
      remainingSeconds:
        existingLock.status === 'unlocked' && existingLock.expiresAt
          ? Math.max(0, Math.floor((existingLock.expiresAt - Date.now()) / 1000))
          : 0,
      downloadAuthToken: existingLock.status === 'unlocked' ? existingLock.downloadAuthToken : null,
      publisherConfigured: Boolean(store.config.publisherId.trim()),
      offerwallConfigured: verStatus.offerwallConfigured,
      verificationConfigured: verStatus.verificationConfigured,
      missingConfigReasons: verStatus.missingConfigReasons,
    });
  });

  // 3. Record Offerwall Redirect / Click (NEVER unlocks the file!)
  app.post('/api/ogads/record-click', (req: Request, res: Response) => {
    const sessionId = getOrCreateVisitorSession(req, res);
    const lockId = typeof req.body?.lockId === 'string' ? req.body.lockId.trim() : '';
    const lock = store.locks[lockId];

    if (!lock || lock.sessionId !== sessionId) {
      res.status(404).json({ error: 'Lock session not found for this visitor.' });
      return;
    }

    refreshLockExpiration(lock);

    if (lock.status === 'locked') {
      lock.status = 'awaiting_offer';
    }
    lock.clicksCount += 1;
    lock.lastClickedAt = Date.now();
    store.stats.totalOfferClicks += 1;
    saveStore();

    const verStatus = getVerificationStatus();

    res.json({
      ok: true,
      lockId: lock.lockId,
      status: lock.status,
      unlocked: lock.status === 'unlocked',
      clicksCount: lock.clicksCount,
      lastClickedAt: lock.lastClickedAt,
      trackingUrl: lock.trackingUrl,
      verificationConfigured: verStatus.verificationConfigured,
      missingConfigReasons: verStatus.missingConfigReasons,
      message:
        'Visitor redirected to OGAds offerwall. Download remains locked until an authentic server-to-server postback conversion confirmation is received from OGAds.',
    });
  });

  // 4. Poll / Check Lock Verification Status
  app.get('/api/ogads/lock-status/:lockId', (req: Request, res: Response) => {
    const sessionId = getOrCreateVisitorSession(req, res);
    const lockId = req.params.lockId;
    const lock = store.locks[lockId];

    if (!lock || lock.sessionId !== sessionId) {
      res.status(404).json({ error: 'Lock session not found.' });
      return;
    }

    refreshLockExpiration(lock);
    const verStatus = getVerificationStatus();

    res.json({
      ok: true,
      lockId: lock.lockId,
      fileId: lock.fileId,
      fileName: lock.fileName,
      docTitle: lock.docTitle,
      status: lock.status,
      unlocked: lock.status === 'unlocked',
      offerName: lock.offerName,
      trackingUrl: lock.trackingUrl,
      clicksCount: lock.clicksCount,
      unlockedAt: lock.unlockedAt,
      expiresAt: lock.expiresAt,
      remainingSeconds:
        lock.status === 'unlocked' && lock.expiresAt
          ? Math.max(0, Math.floor((lock.expiresAt - Date.now()) / 1000))
          : 0,
      downloadAuthToken: lock.status === 'unlocked' ? lock.downloadAuthToken : null,
      conversion:
        lock.status === 'unlocked'
          ? {
              conversionId: lock.conversionId,
              offerId: lock.offerId,
              offerName: lock.offerName,
            }
          : null,
      publisherConfigured: Boolean(store.config.publisherId.trim()),
      offerwallConfigured: verStatus.offerwallConfigured,
      verificationConfigured: verStatus.verificationConfigured,
      missingConfigReasons: verStatus.missingConfigReasons,
    });
  });

  // 5. Official OGAds Server-to-Server (S2S) Postback Endpoint (GET & POST)
  const handleOgadsPostback = (req: Request, res: Response) => {
    const params: Record<string, any> = { ...(req.query || {}), ...(req.body || {}) };

    const providedSecret =
      String(params.secret || params.key || req.headers['x-ogads-secret'] || '').trim();
    const affSub = String(params.aff_sub || params.sub1 || '').trim();
    const affSub2 = String(params.aff_sub2 || params.sub2 || '').trim();
    const offerId = String(params.offer_id || params.offer || '').trim();
    const offerName = String(params.offer_name || 'OGAds Eligible Offer').trim();
    const payoutRaw = String(params.payout || '0').trim();
    const sessionIp = String(params.session_ip || params.ip || '').trim();
    const rawDate = String(params.date || params.datetime || new Date().toISOString()).trim();

    // 1. Verify server postback secret is configured
    if (!store.config.postbackSecret.trim()) {
      res.status(403).json({
        status: 'error',
        error:
          'OGAds postback secret is not configured on this server. Configure the Postback Secret in the Admin Dashboard before receiving live callbacks.',
      });
      return;
    }

    // 2. Verify secret matches using timing-safe comparison
    if (!safeEqual(providedSecret, store.config.postbackSecret.trim())) {
      res.status(403).json({
        status: 'error',
        error: 'Invalid postback authentication secret.',
      });
      return;
    }

    // 3. Optional IP whitelist enforcement
    const requestIp = getClientIp(req);
    if (store.config.allowedPostbackIps.trim()) {
      const allowedList = store.config.allowedPostbackIps
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);
      if (allowedList.length > 0 && !allowedList.includes(requestIp)) {
        res.status(403).json({
          status: 'error',
          error: `Postback IP ${requestIp} is not in the configured allowedPostbackIps whitelist.`,
        });
        return;
      }
    }

    // 4. Validate required OGAds conversion parameters
    if (!affSub || !/^lck_[a-f0-9]{16,32}$/.test(affSub)) {
      res.status(400).json({
        status: 'error',
        error: 'Missing or invalid aff_sub (visitor lockId) parameter in OGAds postback.',
      });
      return;
    }

    if (!offerId) {
      res.status(400).json({
        status: 'error',
        error: 'Missing offer_id parameter in OGAds postback.',
      });
      return;
    }

    const lock = store.locks[affSub];
    if (!lock) {
      res.status(404).json({
        status: 'error',
        error: `No matching visitor lock session found for aff_sub=${affSub}.`,
      });
      return;
    }

    const payout = Number.isFinite(parseFloat(payoutRaw)) ? parseFloat(payoutRaw) : 0;
    if (payout < store.config.minPayout) {
      res.status(400).json({
        status: 'error',
        error: `Conversion payout (${payout}) is below minimum required payout (${store.config.minPayout}).`,
      });
      return;
    }

    // 5. Prevent duplicate conversion credit
    const dedupKey = `${affSub}:${offerId}`;
    const alreadyCredited = store.conversions.some((c) => c.dedupKey === dedupKey);
    if (alreadyCredited) {
      res.status(200).json({
        status: 'duplicate_ignored',
        message: 'Conversion already verified and credited for this lockId and offer_id.',
        lockId: lock.lockId,
      });
      return;
    }

    // 6. Unlock the visitor's requested download with time-limited authorization
    const now = Date.now();
    const durationMs = Math.max(5, store.config.unlockDurationMinutes || 60) * 60 * 1000;
    const downloadAuthToken = 'ulk_' + crypto.randomBytes(28).toString('hex');
    const conversionId = 'cnv_' + crypto.randomBytes(10).toString('hex');

    lock.status = 'unlocked';
    lock.unlockedAt = now;
    lock.expiresAt = now + durationMs;
    lock.downloadAuthToken = downloadAuthToken;
    lock.conversionId = conversionId;
    lock.offerId = offerId;
    lock.offerName = offerName;
    lock.payout = payout;

    const conversionRecord: ConversionRecord = {
      conversionId,
      dedupKey,
      lockId: lock.lockId,
      sessionId: lock.sessionId,
      fileId: affSub2 || lock.fileId,
      fileName: lock.fileName,
      docTitle: lock.docTitle,
      offerId,
      offerName,
      payout,
      sessionIp: sessionIp || lock.visitorIp,
      postbackIp: requestIp,
      verifiedAt: now,
      rawDate,
    };

    store.conversions.unshift(conversionRecord);
    if (store.conversions.length > 500) {
      store.conversions = store.conversions.slice(0, 500);
    }
    store.stats.totalConversions += 1;
    saveStore();

    res.status(200).json({
      status: 'ok',
      message: 'OGAds conversion verified. Visitor download is now unlocked.',
      conversionId,
      lockId: lock.lockId,
      fileId: lock.fileId,
      expiresAt: lock.expiresAt,
    });
  };

  app.get('/api/ogads/postback', handleOgadsPostback);
  app.post('/api/ogads/postback', handleOgadsPostback);

  // 6. Authorize & Record Download Execution
  app.post('/api/ogads/authorize-download', (req: Request, res: Response) => {
    const sessionId = getOrCreateVisitorSession(req, res);
    const lockId = typeof req.body?.lockId === 'string' ? req.body.lockId.trim() : '';
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';

    const lock = store.locks[lockId];
    if (!lock || lock.sessionId !== sessionId) {
      res.status(403).json({
        authorized: false,
        error: 'Unauthorized: Lock record does not belong to your active session.',
      });
      return;
    }

    refreshLockExpiration(lock);

    if (lock.status !== 'unlocked' || !lock.downloadAuthToken) {
      res.status(403).json({
        authorized: false,
        status: lock.status,
        error:
          lock.status === 'expired'
            ? 'Your time-limited download authorization has expired. Please unlock the file again.'
            : 'Download is locked. OGAds conversion verification has not been completed for this file.',
      });
      return;
    }

    if (!safeEqual(lock.downloadAuthToken, token)) {
      res.status(403).json({
        authorized: false,
        error: 'Invalid download authorization token.',
      });
      return;
    }

    lock.downloadCount += 1;
    lock.lastDownloadedAt = Date.now();
    store.stats.totalUnlockedDownloads += 1;
    saveStore();

    res.json({
      ok: true,
      authorized: true,
      lockId: lock.lockId,
      fileId: lock.fileId,
      fileName: lock.fileName,
      docTitle: lock.docTitle,
      expiresAt: lock.expiresAt,
      remainingSeconds: lock.expiresAt ? Math.max(0, Math.floor((lock.expiresAt - Date.now()) / 1000)) : 0,
      downloadCount: lock.downloadCount,
      staticDownloadUrl: lock.staticAssetPath
        ? `/api/ogads/download/${encodeURIComponent(lock.lockId)}?token=${encodeURIComponent(token)}`
        : null,
    });
  });

  // 7. Protected Static File Streaming Endpoint
  app.get('/api/ogads/download/:lockId', (req: Request, res: Response) => {
    const sessionId = getOrCreateVisitorSession(req, res);
    const lockId = req.params.lockId;
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    const lock = store.locks[lockId];
    if (!lock || lock.sessionId !== sessionId) {
      res.status(403).send('Forbidden: Invalid session or lock ID.');
      return;
    }

    refreshLockExpiration(lock);

    if (lock.status !== 'unlocked' || !lock.downloadAuthToken || !safeEqual(lock.downloadAuthToken, token)) {
      res.status(403).send('Forbidden: File download is locked or authorization token has expired.');
      return;
    }

    if (!lock.staticAssetPath) {
      res.status(400).send('This document is dynamically rendered; use the authorized canvas export.');
      return;
    }

    const normalizedAsset = path.normalize(lock.staticAssetPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const candidatePublic = path.join(__dirname, 'public', normalizedAsset);
    const candidateDist = path.join(__dirname, 'dist', normalizedAsset);

    const resolvedFile = fs.existsSync(candidatePublic)
      ? candidatePublic
      : fs.existsSync(candidateDist)
      ? candidateDist
      : null;

    if (!resolvedFile) {
      res.status(404).send('Requested verification file not found on server.');
      return;
    }

    lock.downloadCount += 1;
    lock.lastDownloadedAt = Date.now();
    store.stats.totalUnlockedDownloads += 1;
    saveStore();

    res.download(resolvedFile, lock.fileName);
  });

  // 8. Admin Authentication & Setup Status
  app.get('/api/ogads/admin/status', (req: Request, res: Response) => {
    const token = extractAdminToken(req);
    const isAuthenticated = Boolean(token && adminSessions.has(token) && Date.now() < adminSessions.get(token)!);
    const hasPasswordConfigured = Boolean(store.config.adminPasswordHash);

    res.json({
      ok: true,
      authenticated: isAuthenticated,
      isAuthenticated,
      passwordConfigured: hasPasswordConfigured,
      needsInitialPasswordSetup: !hasPasswordConfigured,
    });
  });

  app.post('/api/ogads/admin/login', (req: Request, res: Response) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password || password.length < 4) {
      res.status(400).json({ error: 'Please provide an admin password (at least 4 characters).' });
      return;
    }

    // If no admin password has been set yet, initialize it with the provided password
    if (!store.config.adminPasswordHash) {
      const salt = crypto.randomBytes(16).toString('hex');
      store.config.adminPasswordSalt = salt;
      store.config.adminPasswordHash = hashPassword(password, salt);
      saveStore();
    } else {
      const candidateHash = hashPassword(password, store.config.adminPasswordSalt);
      if (!safeEqual(candidateHash, store.config.adminPasswordHash)) {
        res.status(401).json({ error: 'Invalid admin password.' });
        return;
      }
    }

    const adminToken = 'adm_' + crypto.randomBytes(24).toString('hex');
    adminSessions.set(adminToken, Date.now() + ADMIN_SESSION_TTL_MS);

    res.json({
      ok: true,
      token: adminToken,
      adminToken,
      expiresInSeconds: ADMIN_SESSION_TTL_MS / 1000,
    });
  });

  app.post('/api/ogads/admin/logout', (req: Request, res: Response) => {
    const token = extractAdminToken(req);
    if (token) adminSessions.delete(token);
    res.json({ ok: true });
  });

  // 9. Admin Dashboard Data (Never exposes raw API keys in plaintext)
  app.get('/api/ogads/admin/dashboard', requireAdminAuth, (req: Request, res: Response) => {
    const verStatus = getVerificationStatus();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const baseUrl = `${protocol}://${host}`;

    const secretPlaceholder = store.config.postbackSecret
      ? store.config.postbackSecret
      : 'YOUR_POSTBACK_SECRET';

    const postbackUrlTemplate = `${baseUrl}/api/ogads/postback?secret=${secretPlaceholder}&aff_sub={aff_sub}&aff_sub2={aff_sub2}&aff_sub3={aff_sub3}&aff_sub4={aff_sub4}&offer_id={offer_id}&offer_name={offer_name}&payout={payout}&session_ip={session_ip}&date={datetime}`;

    const allLocks = Object.values(store.locks).sort((a, b) => b.createdAt - a.createdAt);
    allLocks.forEach(refreshLockExpiration);

    const activeLocksCount = allLocks.filter(
      (l) => l.status === 'locked' || l.status === 'awaiting_offer' || l.status === 'unlocked'
    ).length;
    const unlockedSessions = allLocks.filter((l) => l.status === 'unlocked').length;

    const maskedSecret = store.config.postbackSecret
      ? `${store.config.postbackSecret.slice(0, 5)}${'•'.repeat(10)}`
      : '';
    const maskedApiKey = store.config.apiKey ? `${store.config.apiKey.slice(0, 4)}${'•'.repeat(12)}` : '';

    res.json({
      ok: true,
      postbackUrlTemplate,
      config: {
        trackingLink: store.config.trackingLink,
        publisherId: store.config.publisherId,
        lockerId: store.config.lockerId,
        minPayout: store.config.minPayout,
        requireMinimumPayout: store.config.minPayout,
        unlockDurationMinutes: store.config.unlockDurationMinutes,
        allowedPostbackIps: store.config.allowedPostbackIps,
        allowedIps: store.config.allowedPostbackIps,
        hasPostbackSecret: Boolean(store.config.postbackSecret.trim()),
        postbackSecretMasked: maskedSecret,
        postbackSecretPreview: maskedSecret,
        hasApiKey: Boolean(store.config.apiKey.trim()),
        apiKeyMasked: maskedApiKey,
        apiKeyPreview: maskedApiKey,
        publisherConfigured: Boolean(store.config.publisherId.trim()),
        verificationConfigured: verStatus.verificationConfigured,
        updatedAt: store.config.updatedAt,
        postbackUrlTemplate,
        postbackEndpointPath: `${baseUrl}/api/ogads/postback`,
      },
      status: {
        offerwallConfigured: verStatus.offerwallConfigured,
        verificationConfigured: verStatus.verificationConfigured,
        missingConfigReasons: verStatus.missingConfigReasons,
      },
      stats: {
        ...store.stats,
        activeLocksCount,
        unlockedSessions,
        totalLockSessions: allLocks.length,
      },
      recentConversions: store.conversions.slice(0, 30).map((c) => ({
        ...c,
        timestamp: c.verifiedAt,
        ip: c.sessionIp,
        country: store.locks[c.lockId]?.country || 'global',
      })),
      recentLocks: allLocks.slice(0, 30).map((l) => ({
        lockId: l.lockId,
        fileId: l.fileId,
        fileName: l.fileName,
        docTitle: l.docTitle,
        country: l.country,
        status: l.status,
        clicksCount: l.clicksCount,
        downloadCount: l.downloadCount,
        createdAt: l.createdAt,
        lastClickedAt: l.lastClickedAt,
        unlockedAt: l.unlockedAt,
        expiresAt: l.expiresAt,
        offerId: l.offerId,
        payout: l.payout,
      })),
    });
  });

  // 10. Update Admin Configuration
  app.post('/api/ogads/admin/config', requireAdminAuth, (req: Request, res: Response) => {
    const body = req.body || {};

    if (typeof body.trackingLink === 'string' && body.trackingLink.trim()) {
      const link = body.trackingLink.trim();
      try {
        const parsed = new URL(link);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          res.status(400).json({ error: 'Tracking link must start with https:// or http://' });
          return;
        }
        store.config.trackingLink = link;
      } catch {
        res.status(400).json({ error: 'Invalid OGAds tracking link URL.' });
        return;
      }
    }

    if (typeof body.publisherId === 'string') {
      store.config.publisherId = body.publisherId.trim();
    }

    if (typeof body.lockerId === 'string' && body.lockerId.trim()) {
      store.config.lockerId = body.lockerId.trim();
    }

    const wantNewSecret = body.generateNewPostbackSecret === true || body.generateNewSecret === true;
    if (wantNewSecret) {
      store.config.postbackSecret = 'ogsec_' + crypto.randomBytes(16).toString('hex');
    } else if (typeof body.postbackSecret === 'string' && body.postbackSecret.trim()) {
      store.config.postbackSecret = body.postbackSecret.trim();
    }

    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      store.config.apiKey = body.apiKey.trim();
    } else if (body.clearApiKey === true) {
      store.config.apiKey = '';
    }

    const ipsValue = body.allowedPostbackIps !== undefined ? body.allowedPostbackIps : body.allowedIps;
    if (typeof ipsValue === 'string') {
      store.config.allowedPostbackIps = ipsValue.trim();
    }

    const minPayoutVal = body.minPayout !== undefined ? body.minPayout : body.requireMinimumPayout;
    if (minPayoutVal !== undefined) {
      const mp = parseFloat(String(minPayoutVal));
      if (Number.isFinite(mp) && mp >= 0) {
        store.config.minPayout = mp;
      }
    }

    if (body.unlockDurationMinutes !== undefined) {
      const dur = parseInt(String(body.unlockDurationMinutes), 10);
      if (Number.isFinite(dur) && dur >= 5 && dur <= 10080) {
        store.config.unlockDurationMinutes = dur;
      }
    }

    if (typeof body.newAdminPassword === 'string' && body.newAdminPassword.length >= 4) {
      const salt = crypto.randomBytes(16).toString('hex');
      store.config.adminPasswordSalt = salt;
      store.config.adminPasswordHash = hashPassword(body.newAdminPassword, salt);
    }

    store.config.updatedAt = new Date().toISOString();
    saveStore();

    const verStatus = getVerificationStatus();

    res.json({
      ok: true,
      message: 'OGAds configuration updated and saved on server.',
      generatedPostbackSecret: wantNewSecret ? store.config.postbackSecret : undefined,
      status: verStatus,
    });
  });

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
