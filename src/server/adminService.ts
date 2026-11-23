import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import { createSifaloPaymentService, type UnlockProductKey } from './sifaloPayments.js';

export type SifaloPaymentService = ReturnType<typeof createSifaloPaymentService>;

export type DocTypeKey =
  | 'passport'
  | 'idcard'
  | 'driverlicense'
  | 'refugeecard'
  | 'proofofaccount';

export type AdminRole =
  | 'super_admin'
  | 'content_admin'
  | 'test_admin'
  | 'viewer';

export type AdminPermission =
  | 'dashboard.view'
  | 'countries.view'
  | 'countries.create'
  | 'countries.update'
  | 'countries.enable'
  | 'countries.disable'
  | 'documents.view'
  | 'documents.create'
  | 'documents.update'
  | 'documents.enable'
  | 'documents.disable'
  | 'country_documents.manage'
  | 'png_test.use'
  | 'download_test.use'
  | 'audit.view'
  | 'admins.view'
  | 'admins.create'
  | 'admins.update'
  | 'admins.disable'
  | 'roles.manage'
  | 'payments.settings.view'
  | 'payments.settings.manage';

export const ALL_ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'content_admin',
  'test_admin',
  'viewer',
];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  content_admin: 'Content Admin',
  test_admin: 'Test Admin',
  viewer: 'Viewer',
};

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'dashboard.view',
  'countries.view',
  'countries.create',
  'countries.update',
  'countries.enable',
  'countries.disable',
  'documents.view',
  'documents.create',
  'documents.update',
  'documents.enable',
  'documents.disable',
  'country_documents.manage',
  'png_test.use',
  'download_test.use',
  'audit.view',
  'admins.view',
  'admins.create',
  'admins.update',
  'admins.disable',
  'roles.manage',
  'payments.settings.view',
  'payments.settings.manage',
];

/**
 * Authoritative Server-Side Role -> Permission Matrix
 */
export const ROLE_PERMISSIONS_MAP: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: [
    'dashboard.view',
    'countries.view',
    'countries.create',
    'countries.update',
    'countries.enable',
    'countries.disable',
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.enable',
    'documents.disable',
    'country_documents.manage',
    'png_test.use',
    'download_test.use',
    'audit.view',
    'admins.view',
    'admins.create',
    'admins.update',
    'admins.disable',
    'roles.manage',
    'payments.settings.view',
    'payments.settings.manage',
  ],
  content_admin: [
    'dashboard.view',
    'countries.view',
    'countries.create',
    'countries.update',
    'countries.enable',
    'countries.disable',
    'documents.view',
    'documents.create',
    'documents.update',
    'documents.enable',
    'documents.disable',
    'country_documents.manage',
    'audit.view',
  ],
  test_admin: [
    'dashboard.view',
    'countries.view',
    'documents.view',
    'png_test.use',
    'download_test.use',
  ],
  viewer: [
    'dashboard.view',
    'countries.view',
    'documents.view',
    'audit.view',
  ],
};

export type AdminAuditEventType =
  | 'ADMIN_SETUP_CLAIMED'
  | 'ADMIN_LOGIN_SUCCESS'
  | 'ADMIN_LOGIN_FAILED'
  | 'ADMIN_LOGOUT'
  | 'ADMIN_USER_CREATED'
  | 'ADMIN_USER_UPDATED'
  | 'ADMIN_USER_ENABLED'
  | 'ADMIN_USER_DISABLED'
  | 'ADMIN_PASSWORD_RESET'
  | 'ADMIN_ROLE_CHANGED'
  | 'ADMIN_PERMISSIONS_CHANGED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'COUNTRY_ADDED'
  | 'COUNTRY_UPDATED'
  | 'COUNTRY_ENABLED'
  | 'COUNTRY_DISABLED'
  | 'COUNTRY_REMOVED'
  | 'DOCUMENT_UPDATED'
  | 'DOCUMENT_ENABLED'
  | 'DOCUMENT_DISABLED'
  | 'COUNTRY_DOCUMENTS_UPDATED'
  | 'ADMIN_TEST_MODE_ENABLED'
  | 'ADMIN_TEST_MODE_DISABLED'
  | 'ADMIN_TEST_SAVE_PNG'
  | 'ADMIN_TEST_DOWNLOAD';

export interface AdminUserRecord {
  userId: string;
  username: string;
  displayName: string;
  role: AdminRole;
  customPermissions: AdminPermission[] | null;
  passwordSalt: string;
  passwordHash: string;
  enabled: boolean;
  isEnvBootstrap: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  createdBy: string;
}

export interface PublicAdminUserView {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  role: AdminRole;
  roleLabel: string;
  permissions: AdminPermission[];
  effectivePermissions: AdminPermission[];
  customPermissions: AdminPermission[] | null;
  enabled: boolean;
  isEnvBootstrap: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  createdBy: string;
}

export interface AdminCountryConfig {
  key: string;
  name: string;
  flag: string;
  subtitle: string;
  iso3: string;
  authority: string;
  portalName: string;
  portalUrl: string;
  idStandard: string;
  enabled: boolean;
  isBuiltIn: boolean;
  enabledDocs: DocTypeKey[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminDocumentTypeConfig {
  docType: DocTypeKey;
  productKey: UnlockProductKey;
  name: string;
  categoryLabel: string;
  priceUsd: string;
  description: string;
  icon: string;
  enabled: boolean;
  updatedAt: string;
}

export interface AdminAuditLogEntry {
  eventId: string;
  eventType: AdminAuditEventType;
  actor: string;
  actorRole?: AdminRole | 'unauthenticated';
  timestamp: string;
  targetType:
    | 'auth'
    | 'country'
    | 'document'
    | 'country_documents'
    | 'test_mode'
    | 'admin_user'
    | 'permission';
  targetKey: string | null;
  summary: string;
  metadata: Record<string, string | number | boolean | null>;
}

interface AdminSessionRecord {
  sessionId: string;
  tokenHash: string;
  userId: string;
  username: string;
  role: AdminRole;
  testModeEnabled: boolean;
  createdAtMs: number;
  expiresAtMs: number;
  lastActiveAtMs: number;
}

interface AuthenticatedAdminContext {
  session: AdminSessionRecord;
  user: AdminUserRecord;
  role: AdminRole;
  roleLabel: string;
  permissions: Set<AdminPermission>;
}

interface AdminTestActionTokenRecord {
  authorizationId: string;
  tokenHash: string;
  sessionId: string;
  userId: string;
  username: string;
  role: AdminRole;
  purpose: 'admin_test_only';
  countryKey: string;
  docType: DocTypeKey;
  productKey: UnlockProductKey;
  action: 'save_png' | 'download';
  status: 'AUTHORIZED' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';
  createdAtMs: number;
  expiresAtMs: number;
  consumedAtMs: number | null;
}

interface PersistedAdminState {
  claimedPasswordSalt: string | null;
  claimedPasswordHash: string | null;
  claimedUsername: string | null;
  adminUsers: AdminUserRecord[];
  countries: AdminCountryConfig[];
  documents: AdminDocumentTypeConfig[];
  auditLogs: AdminAuditLogEntry[];
}

const ADMIN_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const ADMIN_TEST_TOKEN_TTL_MS = 60 * 1000; // 60 seconds single-action token
const ADMIN_COOKIE_NAME = 'kyc_admin_session';
const MAX_AUDIT_LOGS = 500;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_LOGINS_PER_WINDOW = 10;

const VALID_DOC_TYPES: DocTypeKey[] = [
  'passport',
  'idcard',
  'driverlicense',
  'refugeecard',
  'proofofaccount',
];

const DOC_TYPE_TO_PRODUCT_KEY: Record<DocTypeKey, UnlockProductKey> = {
  passport: 'passport',
  idcard: 'nationalIdentity',
  driverlicense: 'driverLicense',
  refugeecard: 'proofOfAddress',
  proofofaccount: 'proofOfAccount',
};

function createDefaultDocuments(nowIso: string): AdminDocumentTypeConfig[] {
  return [
    {
      docType: 'passport',
      productKey: 'passport',
      name: 'Passport',
      categoryLabel: 'Biometric e-Passport (ICAO Doc 9303)',
      priceUsd: '1.11',
      description: 'Official machine-readable biometric passport data page & full spread specimen.',
      icon: 'fa-solid fa-passport',
      enabled: true,
      updatedAt: nowIso,
    },
    {
      docType: 'idcard',
      productKey: 'nationalIdentity',
      name: 'National Identity Card',
      categoryLabel: 'Government National ID Card',
      priceUsd: '0.50',
      description: 'Polycarbonate dual-sided national identity card with MRZ & biometric chip.',
      icon: 'fa-solid fa-id-card',
      enabled: true,
      updatedAt: nowIso,
    },
    {
      docType: 'driverlicense',
      productKey: 'driverLicense',
      name: 'Driver License',
      categoryLabel: "Government-Issued Driver's License",
      priceUsd: '0.50',
      description: 'Official photocard driver licence specimen for identity & vehicle verification.',
      icon: 'fa-solid fa-id-badge',
      enabled: true,
      updatedAt: nowIso,
    },
    {
      docType: 'refugeecard',
      productKey: 'proofOfAddress',
      name: 'Proof of Address',
      categoryLabel: 'Utility Bill & Residential Address Verification',
      priceUsd: '0.50',
      description: 'Utility electricity bill & residential proof of address verification document.',
      icon: 'fa-solid fa-bolt',
      enabled: true,
      updatedAt: nowIso,
    },
    {
      docType: 'proofofaccount',
      productKey: 'proofOfAccount',
      name: 'Proof of Account',
      categoryLabel: 'Proof of Address & Account Confirmation',
      priceUsd: '0.50',
      description: 'Official financial institution account confirmation & proof of address statement.',
      icon: 'fa-solid fa-file-invoice-dollar',
      enabled: true,
      updatedAt: nowIso,
    },
  ];
}

function createDefaultCountries(nowIso: string): AdminCountryConfig[] {
  const raw: Array<{
    key: string;
    name: string;
    flag: string;
    subtitle: string;
    iso3: string;
    authority: string;
    portalName: string;
    portalUrl: string;
    idStandard: string;
    enabledDocs: DocTypeKey[];
  }> = [
    {
      key: 'kenya',
      name: 'Kenya',
      flag: '🇰🇪',
      subtitle: 'Maisha Namba & E-Passport',
      iso3: 'KEN',
      authority: 'Directorate of Immigration & Citizen Services (NRB / eCitizen)',
      portalName: 'Kenya eCitizen Immigration Portal',
      portalUrl: 'https://fns.immigration.go.ke',
      idStandard: 'East African Community Biometric e-Passport & Maisha Namba National ID',
      enabledDocs: ['passport', 'idcard', 'proofofaccount'],
    },
    {
      key: 'somalia',
      name: 'Somalia',
      flag: '🇸🇴',
      subtitle: 'National Identity Card & E-Passport',
      iso3: 'SOM',
      authority: 'Immigration and Citizenship Agency (ICA) & National Identification and Registration Authority (NIRA)',
      portalName: 'Federal Republic of Somalia NIRA / ICA',
      portalUrl: 'https://nira.gov.so',
      idStandard: 'Somali Biometric e-Passport, NIRA National Identity Card & Ministry of Transport Driving License',
      enabledDocs: ['passport', 'idcard', 'driverlicense', 'proofofaccount'],
    },
    {
      key: 'ethiopia',
      name: 'Ethiopia',
      flag: '🇪🇹',
      subtitle: 'E-Passport & Fayda ID',
      iso3: 'ETH',
      authority: 'Immigration and Citizenship Service (ICS) & National ID Program (Fayda)',
      portalName: 'Ethiopia Immigration & Fayda Digital ID',
      portalUrl: 'https://id.gov.et',
      idStandard: 'Ethiopian Biometric e-Passport & Fayda 12-Digit FIN National ID',
      enabledDocs: ['passport', 'idcard', 'proofofaccount'],
    },
    {
      key: 'nigeria',
      name: 'Nigeria',
      flag: '🇳🇬',
      subtitle: 'National ID & E-Passport',
      iso3: 'NGA',
      authority: 'Nigeria Immigration Service (NIS) & National Identity Management Commission (NIMC)',
      portalName: 'NIMC & Nigeria Immigration Portal',
      portalUrl: 'https://nimc.gov.ng',
      idStandard: 'ECOWAS Biometric e-Passport & 11-Digit NIN National Identity Card',
      enabledDocs: ['passport', 'idcard', 'proofofaccount'],
    },
    {
      key: 'uk',
      name: 'United Kingdom',
      flag: '🇬🇧',
      subtitle: 'British Citizen Passport',
      iso3: 'GBR',
      authority: 'His Majesty’s Passport Office (HMPO) · Home Office',
      portalName: 'GOV.UK Passport & Identity Guidance',
      portalUrl: 'https://www.gov.uk/browse/abroad/passports',
      idStandard: 'UK Series C Biometric Passport (ICAO Doc 9303) & FCA Address Verification',
      enabledDocs: ['passport', 'proofofaccount'],
    },
    {
      key: 'uganda',
      name: 'Uganda',
      flag: '🇺🇬',
      subtitle: 'National ID Card (NIRA)',
      iso3: 'UGA',
      authority: 'National Identification and Registration Authority (NIRA Uganda) & DCIC',
      portalName: 'NIRA Republic of Uganda',
      portalUrl: 'https://www.nira.go.ug',
      idStandard: 'Uganda 14-Character NIN Polycarbonate National ID Card',
      enabledDocs: ['idcard', 'proofofaccount'],
    },
    {
      key: 'pakistan',
      name: 'Pakistan',
      flag: '🇵🇰',
      subtitle: 'National Identity Card (SNIC)',
      iso3: 'PAK',
      authority: 'National Database & Registration Authority (NADRA) & DGI&P',
      portalName: 'NADRA Official Identity Portal',
      portalUrl: 'https://www.nadra.gov.pk',
      idStandard: 'NADRA Smart National Identity Card (SNIC / CNIC) with ICAO Chip',
      enabledDocs: ['idcard', 'proofofaccount'],
    },
    {
      key: 'senegal',
      name: 'Senegal',
      flag: '🇸🇳',
      subtitle: 'National ID Card & E-Passport',
      iso3: 'SEN',
      authority: 'Direction de l’Automatisation des Fichiers (DAF) · République du Sénégal',
      portalName: 'Senegal CEDEAO Identity & Passport Service',
      portalUrl: 'https://www.interieur.gouv.sn',
      idStandard: 'CEDEAO / ECOWAS Biometric e-Passport & Biometric National ID Card',
      enabledDocs: ['passport', 'idcard'],
    },
    {
      key: 'southafrica',
      name: 'South Africa',
      flag: '🇿🇦',
      subtitle: 'Passport / Passeport (ZAF)',
      iso3: 'ZAF',
      authority: 'Department of Home Affairs (DHA) · Republic of South Africa',
      portalName: 'South Africa Department of Home Affairs',
      portalUrl: 'https://www.dha.gov.za',
      idStandard: 'South African Biometric Tourist / Regular Passport (ICAO Doc 9303)',
      enabledDocs: ['passport'],
    },
    {
      key: 'usa',
      name: 'United States',
      flag: '🇺🇸',
      subtitle: 'U.S. Passport (USA)',
      iso3: 'USA',
      authority: 'U.S. Department of State · Bureau of Consular Affairs',
      portalName: 'Travel.State.Gov U.S. Passports',
      portalUrl: 'https://travel.state.gov',
      idStandard: 'Next Generation U.S. Passport (NGP) Polycarbonate Data Page',
      enabledDocs: ['passport'],
    },
    {
      key: 'seychelles',
      name: 'Seychelles',
      flag: '🇸🇨',
      subtitle: 'National Identity Card',
      iso3: 'SYC',
      authority: 'Department of Immigration & Civil Status · Republic of Seychelles',
      portalName: 'Seychelles Civil Status & Immigration',
      portalUrl: 'https://www.ics.gov.sc',
      idStandard: 'Seychelles National Identity Card (NIN) & Proof of Account',
      enabledDocs: ['idcard', 'proofofaccount'],
    },
    {
      key: 'drcongo',
      name: 'DR Congo',
      flag: '🇨🇩',
      subtitle: 'Passeport Biométrique (COD)',
      iso3: 'COD',
      authority: 'Ministère des Affaires Étrangères · République Démocratique du Congo',
      portalName: 'DRC Biometric Passport Portal',
      portalUrl: 'https://passeport.gouv.cd',
      idStandard: 'DRC Biometric e-Passport (COD) & Bank Address Confirmation',
      enabledDocs: ['passport', 'proofofaccount'],
    },
    {
      key: 'bangladesh',
      name: 'Bangladesh',
      flag: '🇧🇩',
      subtitle: 'e-Passport (ই-পাসপোর্ট / BGD)',
      iso3: 'BGD',
      authority: 'Department of Immigration & Passports (DIP) · People’s Republic of Bangladesh',
      portalName: 'Bangladesh e-Passport Online Portal',
      portalUrl: 'https://www.epassport.gov.bd',
      idStandard: 'Bangladesh ICAO Biometric e-Passport & DESCO Utility Address Proof',
      enabledDocs: ['passport', 'refugeecard'],
    },
    {
      key: 'germany',
      name: 'Germany',
      flag: '🇩🇪',
      subtitle: 'Reisepass (Bundesrepublik Deutschland / D)',
      iso3: 'DEU',
      authority: 'Bundesministerium des Innern und für Heimat (BMI) · Bundesdruckerei',
      portalName: 'Germany Federal Interior Passport Portal',
      portalUrl: 'https://www.personalausweisportal.de',
      idStandard: 'Bundesrepublik Deutschland Biometric Reisepass (EU / ICAO)',
      enabledDocs: ['passport'],
    },
    {
      key: 'canada',
      name: 'Canada',
      flag: '🇨🇦',
      subtitle: 'Passeport / Passport (CAN)',
      iso3: 'CAN',
      authority: 'Immigration, Refugees and Citizenship Canada (IRCC)',
      portalName: 'Government of Canada Passport Services',
      portalUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-passports.html',
      idStandard: 'Next-Generation Canadian e-Passport (Polycarbonate Bio-Page)',
      enabledDocs: ['passport'],
    },
    {
      key: 'ghana',
      name: 'Ghana',
      flag: '🇬🇭',
      subtitle: 'Passport / Passeport (GHA)',
      iso3: 'GHA',
      authority: 'Ministry of Foreign Affairs & Regional Integration · Republic of Ghana',
      portalName: 'Ghana Passport Office Portal',
      portalUrl: 'https://passport.mfa.gov.gh',
      idStandard: 'ECOWAS / Republic of Ghana Biometric e-Passport (GHA)',
      enabledDocs: ['passport'],
    },
    {
      key: 'rwanda',
      name: 'Rwanda',
      flag: '🇷🇼',
      subtitle: 'ID Card (Indangamuntu)',
      iso3: 'RWA',
      authority: 'National Identification Agency (NIDA) · Republic of Rwanda',
      portalName: 'Rwanda NIDA / IremboGov Portal',
      portalUrl: 'https://www.nida.gov.rw',
      idStandard: 'Rwanda Indangamuntu 16-Digit National Identity Card',
      enabledDocs: ['idcard'],
    },
    {
      key: 'nepal',
      name: 'Nepal',
      flag: '🇳🇵',
      subtitle: 'Passport / राहदानी (NPL)',
      iso3: 'NPL',
      authority: 'Department of Passports (DoP) · Ministry of Foreign Affairs Nepal',
      portalName: 'Nepal Department of Passports',
      portalUrl: 'https://nepalpassport.gov.np',
      idStandard: 'Nepal Biometric e-Passport (NPL · ICAO Doc 9303)',
      enabledDocs: ['passport'],
    },
    {
      key: 'malawi',
      name: 'Malawi',
      flag: '🇲🇼',
      subtitle: 'Passport / Passeport (MWI)',
      iso3: 'MWI',
      authority: 'Department of Immigration and Citizenship Services · Republic of Malawi',
      portalName: 'Malawi e-Passport Portal',
      portalUrl: 'https://www.immigration.gov.mw',
      idStandard: 'Republic of Malawi SADC Biometric e-Passport (MWI)',
      enabledDocs: ['passport'],
    },
    {
      key: 'uae',
      name: 'United Arab Emirates',
      flag: '🇦🇪',
      subtitle: 'Resident ID Card (بطاقة هوية)',
      iso3: 'ARE',
      authority: 'Federal Authority for Identity, Citizenship, Customs & Port Security (ICP)',
      portalName: 'UAE ICP Smart Services',
      portalUrl: 'https://icp.gov.ae',
      idStandard: 'UAE Emirates ID Resident Identity Card (784 Series)',
      enabledDocs: ['idcard'],
    },
    {
      key: 'turkey',
      name: 'Turkey',
      flag: '🇹🇷',
      subtitle: 'Pasaport & Kimlik Kartı',
      iso3: 'TUR',
      authority: 'Nüfus ve Vatandaşlık İşleri Genel Müdürlüğü (NVİ) · Republic of Türkiye',
      portalName: 'Türkiye NVİ Identity & Passport Portal',
      portalUrl: 'https://randevu.nvi.gov.tr',
      idStandard: 'Türkiye Biometric Pasaport & T.C. Kimlik Kartı',
      enabledDocs: ['passport', 'idcard'],
    },
    {
      key: 'australia',
      name: 'Australia',
      flag: '🇦🇺',
      subtitle: 'Australian Passport (AUS)',
      iso3: 'AUS',
      authority: 'Australian Passport Office · Department of Foreign Affairs and Trade (DFAT)',
      portalName: 'Australian Passport Office',
      portalUrl: 'https://www.passports.gov.au',
      idStandard: 'Australian Biometric e-Passport (ICAO Doc 9303 · AUS)',
      enabledDocs: ['passport'],
    },
    {
      key: 'newzealand',
      name: 'New Zealand',
      flag: '🇳🇿',
      subtitle: 'Passport & Driver Licence (NZL)',
      iso3: 'NZL',
      authority: 'Waka Kotahi NZ Transport Agency & Department of Internal Affairs',
      portalName: 'Waka Kotahi NZTA & New Zealand Passports',
      portalUrl: 'https://www.nzta.govt.nz/driver-licences/',
      idStandard: 'New Zealand Driver Licence & Biometric e-Passport (NZL)',
      enabledDocs: ['passport', 'driverlicense'],
    },
    {
      key: 'fiji',
      name: 'Fiji',
      flag: '🇫🇯',
      subtitle: 'Fiji Passport (FJI)',
      iso3: 'FJI',
      authority: 'Department of Immigration · Ministry of Immigration',
      portalName: 'Fiji Department of Immigration',
      portalUrl: 'https://www.immigration.gov.fj',
      idStandard: 'Republic of Fiji Biometric e-Passport (FJI)',
      enabledDocs: ['passport'],
    },
    {
      key: 'papuanewguinea',
      name: 'Papua New Guinea',
      flag: '🇵🇬',
      subtitle: 'Passport & NID Card (PNG)',
      iso3: 'PNG',
      authority: 'PNG Immigration & Citizenship Services Authority (ICSA) & PNG Civil and Identity Registry (PNGCIR)',
      portalName: 'PNG ICSA & Civil Registry (NID)',
      portalUrl: 'https://www.icsa.gov.pg',
      idStandard: 'Papua New Guinea e-Passport & National Identification (NID) Card',
      enabledDocs: ['passport', 'idcard'],
    },
    {
      key: 'samoa',
      name: 'Samoa',
      flag: '🇼🇸',
      subtitle: 'Samoa Passport (WSM)',
      iso3: 'WSM',
      authority: 'Immigration Division · Ministry of the Prime Minister and Cabinet',
      portalName: 'Government of Samoa Immigration Services',
      portalUrl: 'https://www.mygov.gov.ws',
      idStandard: 'Independent State of Samoa Machine-Readable Passport (WSM)',
      enabledDocs: ['passport'],
    },
    {
      key: 'tonga',
      name: 'Tonga',
      flag: '🇹🇴',
      subtitle: 'Passport & National ID (TON)',
      iso3: 'TON',
      authority: 'Immigration Division (Ministry of Foreign Affairs) & National Identity Card Office',
      portalName: 'Kingdom of Tonga Immigration & NID Office',
      portalUrl: 'https://www.gov.to',
      idStandard: 'Kingdom of Tonga Passport & National Identity Card (TON)',
      enabledDocs: ['passport', 'idcard'],
    },
    {
      key: 'vanuatu',
      name: 'Vanuatu',
      flag: '🇻🇺',
      subtitle: 'Passport & National ID (VUT)',
      iso3: 'VUT',
      authority: 'Department of Immigration & Passport Services and Civil Registry & Identity Management (CRIMD)',
      portalName: 'Republic of Vanuatu Immigration & Civil Registry',
      portalUrl: 'https://immigration.gov.vu',
      idStandard: 'Republic of Vanuatu Passport & National Identity Card (VUT)',
      enabledDocs: ['passport', 'idcard'],
    },
    {
      key: 'solomonislands',
      name: 'Solomon Islands',
      flag: '🇸🇧',
      subtitle: 'Solomon Islands Passport (SLB)',
      iso3: 'SLB',
      authority: 'Immigration Division · Ministry of Commerce, Industries, Labour and Immigration',
      portalName: 'Solomon Islands Immigration Division',
      portalUrl: 'https://commerce.gov.sb',
      idStandard: 'Solomon Islands Machine-Readable Passport (SLB)',
      enabledDocs: ['passport'],
    },
    {
      key: 'kiribati',
      name: 'Kiribati',
      flag: '🇰🇮',
      subtitle: 'Passport & National ID (KIR)',
      iso3: 'KIR',
      authority: 'Immigration Division (Ministry of Foreign Affairs & Immigration) & Ministry of Justice',
      portalName: 'Republic of Kiribati Immigration & Civil Registry',
      portalUrl: 'https://www.mfa.gov.ki',
      idStandard: 'Republic of Kiribati Passport & National Identity Card (KIR)',
      enabledDocs: ['passport', 'idcard'],
    },
    {
      key: 'micronesia',
      name: 'Federated States of Micronesia',
      flag: '🇫🇲',
      subtitle: 'FSM Passport (FSM)',
      iso3: 'FSM',
      authority: 'Department of Justice · Division of Immigration & Labor',
      portalName: 'FSM Department of Justice Immigration',
      portalUrl: 'https://www.gov.fm',
      idStandard: 'Federated States of Micronesia Biometric Passport (FSM)',
      enabledDocs: ['passport'],
    },
  ];

  return raw.map((item) => ({
    ...item,
    enabled: true,
    isBuiltIn: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function timingSafeCompareStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
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

function normalizeCountryKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 64);
}

function sanitizeText(raw: unknown, maxLen = 180): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, maxLen);
}

export function resolveEffectivePermissions(
  role: AdminRole,
  customPermissions?: AdminPermission[] | null
): AdminPermission[] {
  if (Array.isArray(customPermissions) && customPermissions.length > 0) {
    return Array.from(
      new Set<AdminPermission>(
        customPermissions.filter((p): p is AdminPermission =>
          ALL_ADMIN_PERMISSIONS.includes(p)
        )
      )
    );
  }
  return [...(ROLE_PERMISSIONS_MAP[role] || ROLE_PERMISSIONS_MAP.viewer)];
}

export function toPublicAdminUser(user: AdminUserRecord): PublicAdminUserView {
  const effective = resolveEffectivePermissions(user.role, user.customPermissions);
  return {
    id: user.userId,
    userId: user.userId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    roleLabel: ADMIN_ROLE_LABELS[user.role] || 'Viewer',
    permissions: effective,
    effectivePermissions: effective,
    customPermissions: user.customPermissions ? [...user.customPermissions] : null,
    enabled: user.enabled,
    isEnvBootstrap: Boolean(user.isEnvBootstrap),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    createdBy: user.createdBy,
  };
}

export class KycAdminService {
  private readonly sifaloService: SifaloPaymentService;
  private readonly persistencePath: string;
  private state: PersistedAdminState;
  private readonly sessions = new Map<string, AdminSessionRecord>();
  private readonly testTokens = new Map<string, AdminTestActionTokenRecord>();
  private readonly loginFailuresByIp = new Map<string, { count: number; windowStartMs: number }>();

  constructor(sifaloService: SifaloPaymentService, customPersistencePath?: string) {
    this.sifaloService = sifaloService;
    this.persistencePath = customPersistencePath || this.resolvePersistencePath();
    this.state = this.loadOrInitializeState();
    this.syncBootstrapSuperAdminAccount();
  }

  private resolvePersistencePath(): string {
    const localDataDir = path.resolve(process.cwd(), '.data');
    try {
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true });
      }
      fs.accessSync(localDataDir, fs.constants.W_OK);
      return path.join(localDataDir, 'kyc-admin-state.json');
    } catch {
      return path.join(os.tmpdir(), 'kyc-admin-state.json');
    }
  }

  private loadOrInitializeState(): PersistedAdminState {
    const nowIso = new Date().toISOString();
    const defaultState: PersistedAdminState = {
      claimedPasswordSalt: null,
      claimedPasswordHash: null,
      claimedUsername: null,
      adminUsers: [],
      countries: createDefaultCountries(nowIso),
      documents: createDefaultDocuments(nowIso),
      auditLogs: [],
    };

    try {
      if (fs.existsSync(this.persistencePath)) {
        const raw = fs.readFileSync(this.persistencePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<PersistedAdminState>;
        if (parsed && Array.isArray(parsed.countries) && Array.isArray(parsed.documents)) {
          return {
            claimedPasswordSalt: typeof parsed.claimedPasswordSalt === 'string' ? parsed.claimedPasswordSalt : null,
            claimedPasswordHash: typeof parsed.claimedPasswordHash === 'string' ? parsed.claimedPasswordHash : null,
            claimedUsername: typeof parsed.claimedUsername === 'string' ? parsed.claimedUsername : null,
            adminUsers: Array.isArray(parsed.adminUsers) ? parsed.adminUsers : [],
            countries: parsed.countries.length > 0 ? parsed.countries : defaultState.countries,
            documents: parsed.documents.length > 0 ? parsed.documents : defaultState.documents,
            auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, MAX_AUDIT_LOGS) : [],
          };
        }
      }
    } catch {
      // Fallback to default state if persistence file is unreadable
    }

    this.saveState(defaultState);
    return defaultState;
  }

  private saveState(stateToSave: PersistedAdminState = this.state): void {
    try {
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.persistencePath, JSON.stringify(stateToSave, null, 2), 'utf8');
    } catch {
      // Ignore write failures in read-only environments
    }
  }

  private getConfiguredEnvPassword(): string {
    return (process.env.KYC_ADMIN_PASSWORD || '').trim();
  }

  private getConfiguredEnvUsername(): string {
    return normalizeUsername(process.env.KYC_ADMIN_USERNAME || 'admin') || 'admin';
  }

  /**
   * Ensures that if KYC_ADMIN_PASSWORD or a claimed initial setup password exists,
   * a primary Super Admin record is synchronized in `this.state.adminUsers`.
   */
  private syncBootstrapSuperAdminAccount(): void {
    const nowIso = new Date().toISOString();
    const envPassword = this.getConfiguredEnvPassword();
    const envUsername = this.getConfiguredEnvUsername();

    if (envPassword.length > 0) {
      let existing = this.state.adminUsers.find(
        (u) => u.isEnvBootstrap || u.username.toLowerCase() === envUsername.toLowerCase()
      );
      if (!existing) {
        const saltHex = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPasswordScrypt(envPassword, saltHex);
        existing = {
          userId: 'ADMUSER-BOOTSTRAP-SUPER',
          username: envUsername,
          displayName: 'Primary Super Admin',
          role: 'super_admin',
          customPermissions: null,
          passwordSalt: saltHex,
          passwordHash,
          enabled: true,
          isEnvBootstrap: true,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: null,
          createdBy: 'system',
        };
        this.state.adminUsers.unshift(existing);
        this.saveState();
      } else {
        existing.username = envUsername;
        existing.role = 'super_admin';
        existing.isEnvBootstrap = true;
      }
      return;
    }

    if (
      this.state.claimedUsername &&
      this.state.claimedPasswordSalt &&
      this.state.claimedPasswordHash
    ) {
      const claimedUser = this.state.claimedUsername;
      const exists = this.state.adminUsers.some(
        (u) => u.username.toLowerCase() === claimedUser.toLowerCase()
      );
      if (!exists) {
        this.state.adminUsers.unshift({
          userId: 'ADMUSER-CLAIMED-SUPER',
          username: claimedUser,
          displayName: 'Primary Super Admin',
          role: 'super_admin',
          customPermissions: null,
          passwordSalt: this.state.claimedPasswordSalt,
          passwordHash: this.state.claimedPasswordHash,
          enabled: true,
          isEnvBootstrap: true,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: null,
          createdBy: 'setup',
        });
        this.saveState();
      }
    }
  }

  public isInitialSetupRequired(): boolean {
    const envPassword = this.getConfiguredEnvPassword();
    if (envPassword.length > 0) {
      return false;
    }
    if (this.state.adminUsers.length > 0) {
      return false;
    }
    return !(this.state.claimedPasswordSalt && this.state.claimedPasswordHash);
  }

  private countActiveSuperAdmins(): number {
    this.syncBootstrapSuperAdminAccount();
    return this.state.adminUsers.filter((u) => u.enabled && u.role === 'super_admin').length;
  }

  private recordAuditEvent(params: {
    eventType: AdminAuditEventType;
    actor: string;
    actorRole?: AdminRole | 'unauthenticated';
    targetType: AdminAuditLogEntry['targetType'];
    targetKey: string | null;
    summary: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): AdminAuditLogEntry {
    const entry: AdminAuditLogEntry = {
      eventId: `AUD-${crypto.randomUUID()}`,
      eventType: params.eventType,
      actor: params.actor || 'admin',
      actorRole: params.actorRole || 'unauthenticated',
      timestamp: new Date().toISOString(),
      targetType: params.targetType,
      targetKey: params.targetKey,
      summary: params.summary,
      metadata: params.metadata || {},
    };
    this.state.auditLogs.unshift(entry);
    if (this.state.auditLogs.length > MAX_AUDIT_LOGS) {
      this.state.auditLogs.length = MAX_AUDIT_LOGS;
    }
    this.saveState();
    return entry;
  }

  private cleanupExpiredSessionsAndTokens(nowMs = Date.now()): void {
    for (const [tokenHash, session] of this.sessions.entries()) {
      if (nowMs >= session.expiresAtMs) {
        this.sessions.delete(tokenHash);
      }
    }
    for (const [tokenHash, record] of this.testTokens.entries()) {
      if (record.status === 'AUTHORIZED' && nowMs >= record.expiresAtMs) {
        record.status = 'EXPIRED';
      }
      if (nowMs - record.createdAtMs > 30 * 60 * 1000) {
        this.testTokens.delete(tokenHash);
      }
    }
  }

  private revokeSessionsAndTokensForUser(userId: string): void {
    for (const [tokenHash, sess] of this.sessions.entries()) {
      if (sess.userId === userId) {
        this.sessions.delete(tokenHash);
      }
    }
    for (const record of this.testTokens.values()) {
      if (record.userId === userId && record.status === 'AUTHORIZED') {
        record.status = 'REVOKED';
      }
    }
  }

  private revokeTestTokensForUser(userId: string): void {
    for (const record of this.testTokens.values()) {
      if (record.userId === userId && record.status === 'AUTHORIZED') {
        record.status = 'REVOKED';
      }
    }
  }

  private extractRawTokenFromRequest(req: Request): string {
    const authHeader = (req.headers.authorization || '').trim();
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }
    const csrfHeader = String(req.headers['x-kyc-admin-request'] || '').trim();
    if (csrfHeader === '1') {
      const cookies = parseCookies(req.headers.cookie);
      return (cookies[ADMIN_COOKIE_NAME] || '').trim();
    }
    return '';
  }

  /**
   * Resolves the authenticated admin context from the server-side session AND live AdminUserRecord.
   * Never trusts any role or permission information sent by the client.
   */
  private resolveAdminContext(req: Request): {
    status: 'ok' | 'unauthenticated' | 'disabled';
    context: AuthenticatedAdminContext | null;
    disabledUser?: AdminUserRecord;
  } {
    this.cleanupExpiredSessionsAndTokens();
    this.syncBootstrapSuperAdminAccount();

    const rawToken = this.extractRawTokenFromRequest(req);
    if (!rawToken || !rawToken.startsWith('kycadm_')) {
      return { status: 'unauthenticated', context: null };
    }

    const tokenHash = sha256Hex(rawToken);
    const session = this.sessions.get(tokenHash);
    if (!session) {
      return { status: 'unauthenticated', context: null };
    }

    const nowMs = Date.now();
    if (nowMs >= session.expiresAtMs) {
      this.sessions.delete(tokenHash);
      return { status: 'unauthenticated', context: null };
    }

    const user = this.state.adminUsers.find((u) => u.userId === session.userId);
    if (!user) {
      this.sessions.delete(tokenHash);
      return { status: 'unauthenticated', context: null };
    }

    if (!user.enabled) {
      this.revokeSessionsAndTokensForUser(user.userId);
      return { status: 'disabled', context: null, disabledUser: user };
    }

    session.lastActiveAtMs = nowMs;
    session.role = user.role;
    session.username = user.username;

    const effectivePerms = resolveEffectivePermissions(user.role, user.customPermissions);
    const permSet = new Set<AdminPermission>(effectivePerms);

    // If user no longer has test permissions, force testModeEnabled off
    if (!permSet.has('png_test.use') && !permSet.has('download_test.use')) {
      session.testModeEnabled = false;
    }

    return {
      status: 'ok',
      context: {
        session,
        user,
        role: user.role,
        roleLabel: ADMIN_ROLE_LABELS[user.role] || 'Viewer',
        permissions: permSet,
      },
    };
  }

  private formatSessionResponse(ctx: AuthenticatedAdminContext) {
    return {
      sessionId: ctx.session.sessionId,
      userId: ctx.user.userId,
      username: ctx.user.username,
      displayName: ctx.user.displayName,
      role: ctx.role,
      roleLabel: ctx.roleLabel,
      permissions: Array.from(ctx.permissions),
      testModeEnabled: ctx.session.testModeEnabled,
      expiresAt: new Date(ctx.session.expiresAtMs).toISOString(),
    };
  }

  private setSessionCookie(res: Response, rawToken: string): void {
    const maxAgeSec = Math.floor(ADMIN_SESSION_TTL_MS / 1000);
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/api/admin; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }

  private clearSessionCookie(res: Response): void {
    res.setHeader(
      'Set-Cookie',
      `${ADMIN_COOKIE_NAME}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }

  private checkLoginRateLimit(ipKey: string): { allowed: boolean; retryAfterSec: number } {
    const nowMs = Date.now();
    const record = this.loginFailuresByIp.get(ipKey);
    if (!record) return { allowed: true, retryAfterSec: 0 };
    if (nowMs - record.windowStartMs >= LOGIN_WINDOW_MS) {
      this.loginFailuresByIp.delete(ipKey);
      return { allowed: true, retryAfterSec: 0 };
    }
    if (record.count >= MAX_FAILED_LOGINS_PER_WINDOW) {
      const retryAfterSec = Math.ceil((LOGIN_WINDOW_MS - (nowMs - record.windowStartMs)) / 1000);
      return { allowed: false, retryAfterSec };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  private registerFailedLogin(ipKey: string): void {
    const nowMs = Date.now();
    const record = this.loginFailuresByIp.get(ipKey);
    if (!record || nowMs - record.windowStartMs >= LOGIN_WINDOW_MS) {
      this.loginFailuresByIp.set(ipKey, { count: 1, windowStartMs: nowMs });
    } else {
      record.count += 1;
    }
  }

  private clearFailedLogin(ipKey: string): void {
    this.loginFailuresByIp.delete(ipKey);
  }

  private createAdminSession(user: AdminUserRecord): { rawToken: string; session: AdminSessionRecord } {
    const rawToken = `kycadm_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = sha256Hex(rawToken);
    const nowMs = Date.now();
    const session: AdminSessionRecord = {
      sessionId: `ADMSESS-${crypto.randomUUID()}`,
      tokenHash,
      userId: user.userId,
      username: user.username,
      role: user.role,
      testModeEnabled: false,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + ADMIN_SESSION_TTL_MS,
      lastActiveAtMs: nowMs,
    };
    this.sessions.set(tokenHash, session);
    return { rawToken, session };
  }

  public getPublicCatalog() {
    const globallyEnabledDocs = new Set<DocTypeKey>(
      this.state.documents.filter((d) => d.enabled).map((d) => d.docType)
    );

    const allCountryStates = this.state.countries.map((c) => ({
      key: c.key,
      enabled: c.enabled,
      enabledDocs: c.enabledDocs.filter((doc) => globallyEnabledDocs.has(doc)),
    }));

    const enabledCountries = this.state.countries
      .filter((c) => c.enabled)
      .map((c) => ({
        key: c.key,
        name: c.name,
        flag: c.flag,
        subtitle: c.subtitle,
        iso3: c.iso3,
        authority: c.authority,
        portalName: c.portalName,
        portalUrl: c.portalUrl,
        idStandard: c.idStandard,
        enabled: c.enabled,
        isBuiltIn: c.isBuiltIn,
        enabledDocs: c.enabledDocs.filter((doc) => globallyEnabledDocs.has(doc)),
      }));

    return {
      countries: enabledCountries,
      allCountryStates,
      documents: this.state.documents.map((d) => ({ ...d })),
      updatedAt: new Date().toISOString(),
    };
  }

  public getAuditLogsForContext(ctx: AuthenticatedAdminContext): AdminAuditLogEntry[] {
    let logs = this.state.auditLogs.map((entry) => ({
      ...entry,
      metadata: { ...entry.metadata },
    }));

    // Content Admin sees relevant content-management audit logs
    if (ctx.role === 'content_admin') {
      logs = logs.filter((entry) =>
        entry.targetType === 'country' ||
        entry.targetType === 'document' ||
        entry.targetType === 'country_documents'
      );
    } else if (ctx.role === 'viewer') {
      // Viewer sees non-sensitive audit information (content & general status, excluding internal user/permission security events)
      logs = logs.filter((entry) =>
        entry.targetType === 'country' ||
        entry.targetType === 'document' ||
        entry.targetType === 'country_documents'
      );
    }

    return logs;
  }

  public createPublicCatalogRouter(): express.Router {
    const router = express.Router();

    router.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });

    router.get('/', (_req: Request, res: Response) => {
      return res.status(200).json({
        ok: true,
        ...this.getPublicCatalog(),
      });
    });

    return router;
  }

  public createAdminRouter(): express.Router {
    const router = express.Router();

    router.use((_req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });

    // Public auth status check (never leaks secrets)
    router.get('/auth/status', (req: Request, res: Response) => {
      const resolved = this.resolveAdminContext(req);
      const ctx = resolved.context;
      return res.status(200).json({
        ok: true,
        authenticated: Boolean(ctx),
        needsInitialSetup: this.isInitialSetupRequired(),
        session: ctx ? this.formatSessionResponse(ctx) : null,
      });
    });

    // First-run one-time Super Admin password setup
    router.post('/auth/setup', (req: Request, res: Response) => {
      if (!this.isInitialSetupRequired()) {
        return res.status(403).json({
          ok: false,
          error: 'Admin credentials are already configured. Please sign in with your admin password.',
        });
      }

      const username = normalizeUsername(sanitizeText(req.body?.username, 64)) || 'admin';
      const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

      if (password.length < 8) {
        return res.status(400).json({
          ok: false,
          error: 'Admin password must be at least 8 characters long.',
        });
      }

      const saltHex = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPasswordScrypt(password, saltHex);
      const nowIso = new Date().toISOString();

      this.state.claimedUsername = username;
      this.state.claimedPasswordSalt = saltHex;
      this.state.claimedPasswordHash = passwordHash;

      const superUser: AdminUserRecord = {
        userId: 'ADMUSER-CLAIMED-SUPER',
        username,
        displayName: 'Primary Super Admin',
        role: 'super_admin',
        customPermissions: null,
        passwordSalt: saltHex,
        passwordHash,
        enabled: true,
        isEnvBootstrap: true,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
        createdBy: 'setup',
      };

      this.state.adminUsers = [superUser];
      this.saveState();

      this.recordAuditEvent({
        eventType: 'ADMIN_SETUP_CLAIMED',
        actor: username,
        actorRole: 'super_admin',
        targetType: 'auth',
        targetKey: username,
        summary: `Initial Super Admin account '${username}' configured and locked.`,
        metadata: { username, role: 'super_admin' },
      });

      const { rawToken, session } = this.createAdminSession(superUser);
      this.setSessionCookie(res, rawToken);

      this.recordAuditEvent({
        eventType: 'ADMIN_LOGIN_SUCCESS',
        actor: username,
        actorRole: 'super_admin',
        targetType: 'auth',
        targetKey: session.sessionId,
        summary: `Super Admin '${username}' signed in after initial setup.`,
        metadata: { sessionId: session.sessionId, role: 'super_admin' },
      });

      const ctx: AuthenticatedAdminContext = {
        session,
        user: superUser,
        role: superUser.role,
        roleLabel: ADMIN_ROLE_LABELS[superUser.role],
        permissions: new Set(resolveEffectivePermissions(superUser.role, superUser.customPermissions)),
      };

      return res.status(200).json({
        ok: true,
        authenticated: true,
        adminToken: rawToken,
        session: this.formatSessionResponse(ctx),
      });
    });

    // Server-side Admin Login (supports bootstrap Super Admin and all managed Admin Users across roles)
    router.post('/auth/login', (req: Request, res: Response) => {
      const ipKey = String(req.ip || req.socket?.remoteAddress || 'unknown');
      const rateCheck = this.checkLoginRateLimit(ipKey);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          ok: false,
          error: `Too many failed login attempts. Try again in ${rateCheck.retryAfterSec} seconds.`,
        });
      }

      if (this.isInitialSetupRequired()) {
        return res.status(403).json({
          ok: false,
          needsInitialSetup: true,
          error: 'Initial admin password setup is required before logging in.',
        });
      }

      this.syncBootstrapSuperAdminAccount();

      const suppliedUsername = normalizeUsername(sanitizeText(req.body?.username, 64)) || 'admin';
      const suppliedPassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

      if (!suppliedPassword) {
        return res.status(400).json({
          ok: false,
          error: 'Admin password is required.',
        });
      }

      const matchedUser = this.state.adminUsers.find((u) =>
        timingSafeCompareStrings(u.username.toLowerCase(), suppliedUsername.toLowerCase())
      );

      if (!matchedUser) {
        this.registerFailedLogin(ipKey);
        this.recordAuditEvent({
          eventType: 'ADMIN_LOGIN_FAILED',
          actor: suppliedUsername,
          actorRole: 'unauthenticated',
          targetType: 'auth',
          targetKey: suppliedUsername,
          summary: `Failed admin login attempt for unknown username '${suppliedUsername}'.`,
          metadata: { username: suppliedUsername },
        });
        return res.status(401).json({
          ok: false,
          error: 'Invalid admin credentials.',
        });
      }

      const envPassword = this.getConfiguredEnvPassword();
      let passwordMatches = false;

      if (matchedUser.isEnvBootstrap && envPassword.length > 0) {
        passwordMatches = timingSafeCompareStrings(suppliedPassword, envPassword);
      } else {
        passwordMatches = verifyPasswordScrypt(
          suppliedPassword,
          matchedUser.passwordSalt,
          matchedUser.passwordHash
        );
      }

      if (!passwordMatches) {
        this.registerFailedLogin(ipKey);
        this.recordAuditEvent({
          eventType: 'ADMIN_LOGIN_FAILED',
          actor: matchedUser.username,
          actorRole: matchedUser.role,
          targetType: 'auth',
          targetKey: matchedUser.username,
          summary: `Failed admin login attempt (invalid password) for '${matchedUser.username}'.`,
          metadata: { username: matchedUser.username, role: matchedUser.role },
        });
        return res.status(401).json({
          ok: false,
          error: 'Invalid admin credentials.',
        });
      }

      if (!matchedUser.enabled) {
        this.recordAuditEvent({
          eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          actor: matchedUser.username,
          actorRole: matchedUser.role,
          targetType: 'auth',
          targetKey: matchedUser.userId,
          summary: `Blocked login attempt by disabled admin account '${matchedUser.username}' (${ADMIN_ROLE_LABELS[matchedUser.role]}).`,
          metadata: {
            userId: matchedUser.userId,
            username: matchedUser.username,
            role: matchedUser.role,
            reason: 'account_disabled',
          },
        });
        return res.status(403).json({
          ok: false,
          error: 'This admin account is currently disabled. Contact a Super Admin.',
        });
      }

      this.clearFailedLogin(ipKey);
      matchedUser.lastLoginAt = new Date().toISOString();
      this.saveState();

      const { rawToken, session } = this.createAdminSession(matchedUser);
      this.setSessionCookie(res, rawToken);

      this.recordAuditEvent({
        eventType: 'ADMIN_LOGIN_SUCCESS',
        actor: matchedUser.username,
        actorRole: matchedUser.role,
        targetType: 'auth',
        targetKey: session.sessionId,
        summary: `Admin '${matchedUser.username}' (${ADMIN_ROLE_LABELS[matchedUser.role]}) authenticated successfully.`,
        metadata: {
          sessionId: session.sessionId,
          userId: matchedUser.userId,
          role: matchedUser.role,
        },
      });

      const ctx: AuthenticatedAdminContext = {
        session,
        user: matchedUser,
        role: matchedUser.role,
        roleLabel: ADMIN_ROLE_LABELS[matchedUser.role],
        permissions: new Set(resolveEffectivePermissions(matchedUser.role, matchedUser.customPermissions)),
      };

      return res.status(200).json({
        ok: true,
        authenticated: true,
        adminToken: rawToken,
        session: this.formatSessionResponse(ctx),
      });
    });

    // Server-side Admin Logout
    router.post('/auth/logout', (req: Request, res: Response) => {
      const resolved = this.resolveAdminContext(req);
      const ctx = resolved.context;
      if (ctx) {
        this.sessions.delete(ctx.session.tokenHash);
        for (const record of this.testTokens.values()) {
          if (record.sessionId === ctx.session.sessionId && record.status === 'AUTHORIZED') {
            record.status = 'REVOKED';
          }
        }
        this.recordAuditEvent({
          eventType: 'ADMIN_LOGOUT',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'auth',
          targetKey: ctx.session.sessionId,
          summary: `Admin '${ctx.user.username}' (${ctx.roleLabel}) logged out and session invalidated.`,
          metadata: { sessionId: ctx.session.sessionId, role: ctx.role },
        });
      }
      this.clearSessionCookie(res);
      return res.status(200).json({
        ok: true,
        authenticated: false,
        message: 'Admin session terminated.',
      });
    });

    /**
     * Centralized Server-Side Authentication & Role/Permission Enforcement Middleware
     * Verifies:
     * 1. Valid authenticated admin session (401 if unauthenticated)
     * 2. Admin account is active (403 if disabled)
     * 3. User's assigned server-side role
     * 4. Required permission(s) for the requested resource/action (403 if unauthorized)
     */
    const requireAdminAuth = (req: Request, res: Response, next: NextFunction) => {
      const resolved = this.resolveAdminContext(req);
      if (resolved.status === 'disabled') {
        const disabledUser = resolved.disabledUser;
        this.recordAuditEvent({
          eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          actor: disabledUser ? disabledUser.username : 'disabled_admin',
          actorRole: disabledUser ? disabledUser.role : 'unauthenticated',
          targetType: 'auth',
          targetKey: req.path,
          summary: `Blocked API access to '${req.method} ${req.path}' by disabled admin account '${disabledUser?.username || 'unknown'}'.`,
          metadata: {
            method: req.method,
            path: req.path,
            reason: 'account_disabled',
          },
        });
        return res.status(403).json({
          ok: false,
          error: 'Forbidden: Your admin account has been disabled.',
        });
      }

      if (resolved.status !== 'ok' || !resolved.context) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized: Valid server-side admin authentication is required.',
        });
      }

      (req as Request & { adminContext?: AuthenticatedAdminContext }).adminContext =
        resolved.context;
      next();
    };

    const requirePermission = (
      required: AdminPermission | AdminPermission[],
      mode: 'all' | 'any' = 'all'
    ) => {
      const requiredList = Array.isArray(required) ? required : [required];
      return (req: Request, res: Response, next: NextFunction) => {
        const ctx = (req as Request & { adminContext?: AuthenticatedAdminContext }).adminContext;
        if (!ctx) {
          return res.status(401).json({
            ok: false,
            error: 'Unauthorized: Valid server-side admin authentication is required.',
          });
        }

        const hasAccess =
          mode === 'any'
            ? requiredList.some((perm) => ctx.permissions.has(perm))
            : requiredList.every((perm) => ctx.permissions.has(perm));

        if (!hasAccess) {
          this.recordAuditEvent({
            eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            actor: ctx.user.username,
            actorRole: ctx.role,
            targetType: 'permission',
            targetKey: `${req.method} ${req.path}`,
            summary: `Denied '${ctx.user.username}' (${ctx.roleLabel}) access to ${req.method} ${req.path} — missing permission [${requiredList.join(', ')}].`,
            metadata: {
              userId: ctx.user.userId,
              role: ctx.role,
              requiredPermissions: requiredList.join(','),
              method: req.method,
              path: req.path,
            },
          });
          return res.status(403).json({
            ok: false,
            error: `Forbidden: Your role (${ctx.roleLabel}) does not have the required permission (${requiredList.join(', ')}) for this action.`,
            requiredPermissions: requiredList,
            currentRole: ctx.role,
          });
        }

        next();
      };
    };

    router.use(requireAdminAuth);

    // Roles & Permissions Matrix Metadata Endpoint
    router.get(
      '/roles-metadata',
      requirePermission('dashboard.view'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        return res.status(200).json({
          ok: true,
          currentRole: ctx.role,
          currentRoleLabel: ctx.roleLabel,
          currentPermissions: Array.from(ctx.permissions),
          roles: ALL_ADMIN_ROLES.map((r) => ({
            role: r,
            label: ADMIN_ROLE_LABELS[r],
            defaultPermissions: [...ROLE_PERMISSIONS_MAP[r]],
          })),
          allPermissions: [...ALL_ADMIN_PERMISSIONS],
        });
      }
    );

    // Dashboard Overview
    router.get(
      '/overview',
      requirePermission('dashboard.view'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const totalCountries = this.state.countries.length;
        const enabledCountries = this.state.countries.filter((c) => c.enabled).length;
        const disabledCountries = totalCountries - enabledCountries;
        const customCountries = this.state.countries.filter((c) => !c.isBuiltIn).length;
        const totalDocuments = this.state.documents.length;
        const enabledDocuments = this.state.documents.filter((d) => d.enabled).length;
        const totalMappings = this.state.countries.reduce(
          (acc, c) => acc + (c.enabled ? c.enabledDocs.length : 0),
          0
        );
        const unlockAuditSummary = this.sifaloService.getUnlockAuditSummary();
        const visibleAuditLogs = ctx.permissions.has('audit.view')
          ? this.getAuditLogsForContext(ctx)
          : [];

        return res.status(200).json({
          ok: true,
          session: this.formatSessionResponse(ctx),
          stats: {
            totalCountries,
            enabledCountries,
            disabledCountries,
            customCountries,
            totalDocuments,
            enabledDocuments,
            totalActiveCountryDocMappings: totalMappings,
            totalAuditEvents: visibleAuditLogs.length,
            totalAdminUsers: ctx.permissions.has('admins.view')
              ? this.state.adminUsers.length
              : undefined,
          },
          unlockLifecycleSummary: {
            totalAuthorizations: unlockAuditSummary.totalTrackedAuthorizations,
            statusCounts: unlockAuditSummary.countsByStatus,
          },
          recentAuditLogs: visibleAuditLogs.slice(0, 12),
        });
      }
    );

    // 1. COUNTRIES CRUD
    router.get(
      '/countries',
      requirePermission('countries.view'),
      (req: Request, res: Response) => {
        const search = sanitizeText(req.query.search, 80).toLowerCase();
        const statusFilter = sanitizeText(req.query.status, 24).toLowerCase();
        const docFilter = sanitizeText(req.query.docType, 32).toLowerCase();

        let list = this.state.countries.map((c) => ({ ...c, enabledDocs: [...c.enabledDocs] }));

        if (search) {
          list = list.filter(
            (c) =>
              c.name.toLowerCase().includes(search) ||
              c.key.toLowerCase().includes(search) ||
              c.iso3.toLowerCase().includes(search) ||
              c.subtitle.toLowerCase().includes(search)
          );
        }
        if (statusFilter === 'enabled') {
          list = list.filter((c) => c.enabled);
        } else if (statusFilter === 'disabled') {
          list = list.filter((c) => !c.enabled);
        }
        if (docFilter && VALID_DOC_TYPES.includes(docFilter as DocTypeKey)) {
          list = list.filter((c) => c.enabledDocs.includes(docFilter as DocTypeKey));
        }

        return res.status(200).json({
          ok: true,
          countries: list,
        });
      }
    );

    router.post(
      '/countries',
      requirePermission('countries.create'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const name = sanitizeText(req.body?.name, 80);
        const rawKey = sanitizeText(req.body?.key || name, 40);
        const key = normalizeCountryKey(rawKey);
        const flag = sanitizeText(req.body?.flag, 16) || '🌍';
        const iso3 = (sanitizeText(req.body?.iso3, 3) || key.slice(0, 3)).toUpperCase();
        const subtitle = sanitizeText(req.body?.subtitle, 100) || `Passport & National ID (${iso3})`;
        const authority =
          sanitizeText(req.body?.authority, 160) ||
          `Department of Immigration & National Identity Registry (${name})`;
        const portalName = sanitizeText(req.body?.portalName, 120) || `${name} Official Identity Portal`;
        const portalUrl = sanitizeText(req.body?.portalUrl, 160) || 'https://www.icao.int';
        const idStandard =
          sanitizeText(req.body?.idStandard, 160) ||
          `${name} Biometric e-Passport & National Identity Card (${iso3})`;
        const enabled = req.body?.enabled !== false;

        if (!name || !key || key.length < 2) {
          return res.status(400).json({
            ok: false,
            error: 'A valid country name and key (at least 2 alphanumeric characters) are required.',
          });
        }

        if (this.state.countries.some((c) => c.key === key)) {
          return res.status(409).json({
            ok: false,
            error: `A country with key '${key}' already exists.`,
          });
        }

        const rawDocs: unknown[] = Array.isArray(req.body?.enabledDocs)
          ? req.body.enabledDocs
          : ['passport', 'idcard'];
        const enabledDocs: DocTypeKey[] = Array.from(
          new Set<DocTypeKey>(
            rawDocs
              .map((d) => String(d).trim() as DocTypeKey)
              .filter((d) => VALID_DOC_TYPES.includes(d))
          )
        );

        const nowIso = new Date().toISOString();
        const newCountry: AdminCountryConfig = {
          key,
          name,
          flag,
          subtitle,
          iso3,
          authority,
          portalName,
          portalUrl,
          idStandard,
          enabled,
          isBuiltIn: false,
          enabledDocs: enabledDocs.length > 0 ? enabledDocs : ['passport'],
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        this.state.countries.push(newCountry);
        this.saveState();

        this.recordAuditEvent({
          eventType: 'COUNTRY_ADDED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'country',
          targetKey: key,
          summary: `Added country '${name}' (${iso3}) with documents: ${newCountry.enabledDocs.join(', ')}.`,
          metadata: {
            countryKey: key,
            name,
            iso3,
            enabled,
            enabledDocs: newCountry.enabledDocs.join(','),
          },
        });

        return res.status(201).json({
          ok: true,
          country: newCountry,
        });
      }
    );

    router.put(
      '/countries/:key',
      requirePermission('countries.update'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const key = normalizeCountryKey(req.params.key || '');
        const country = this.state.countries.find((c) => c.key === key);
        if (!country) {
          return res.status(404).json({
            ok: false,
            error: `Country '${key}' not found.`,
          });
        }

        if (typeof req.body?.name === 'string' && req.body.name.trim()) {
          country.name = sanitizeText(req.body.name, 80);
        }
        if (typeof req.body?.flag === 'string' && req.body.flag.trim()) {
          country.flag = sanitizeText(req.body.flag, 16);
        }
        if (typeof req.body?.subtitle === 'string' && req.body.subtitle.trim()) {
          country.subtitle = sanitizeText(req.body.subtitle, 100);
        }
        if (typeof req.body?.iso3 === 'string' && req.body.iso3.trim()) {
          country.iso3 = sanitizeText(req.body.iso3, 3).toUpperCase();
        }
        if (typeof req.body?.authority === 'string') {
          country.authority = sanitizeText(req.body.authority, 160) || country.authority;
        }
        if (typeof req.body?.portalName === 'string') {
          country.portalName = sanitizeText(req.body.portalName, 120) || country.portalName;
        }
        if (typeof req.body?.portalUrl === 'string') {
          country.portalUrl = sanitizeText(req.body.portalUrl, 160) || country.portalUrl;
        }
        if (typeof req.body?.idStandard === 'string') {
          country.idStandard = sanitizeText(req.body.idStandard, 160) || country.idStandard;
        }
        if (typeof req.body?.enabled === 'boolean') {
          const permNeeded: AdminPermission = req.body.enabled
            ? 'countries.enable'
            : 'countries.disable';
          if (!ctx.permissions.has(permNeeded)) {
            return res.status(403).json({
              ok: false,
              error: `Forbidden: Missing permission '${permNeeded}'.`,
            });
          }
          country.enabled = req.body.enabled;
        }
        if (Array.isArray(req.body?.enabledDocs)) {
          if (!ctx.permissions.has('country_documents.manage')) {
            return res.status(403).json({
              ok: false,
              error: "Forbidden: Missing permission 'country_documents.manage'.",
            });
          }
          const rawList: unknown[] = req.body.enabledDocs;
          const docs: DocTypeKey[] = Array.from(
            new Set<DocTypeKey>(
              rawList
                .map((d: unknown) => String(d).trim() as DocTypeKey)
                .filter((d: DocTypeKey) => VALID_DOC_TYPES.includes(d))
            )
          );
          country.enabledDocs = docs;
        }

        country.updatedAt = new Date().toISOString();
        this.saveState();

        this.recordAuditEvent({
          eventType: 'COUNTRY_UPDATED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'country',
          targetKey: country.key,
          summary: `Updated country '${country.name}' (${country.key}).`,
          metadata: {
            countryKey: country.key,
            name: country.name,
            iso3: country.iso3,
            enabled: country.enabled,
            enabledDocs: country.enabledDocs.join(','),
          },
        });

        return res.status(200).json({
          ok: true,
          country,
        });
      }
    );

    router.patch(
      '/countries/:key/toggle',
      requirePermission(['countries.enable', 'countries.disable'], 'any'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const key = normalizeCountryKey(req.params.key || '');
        const country = this.state.countries.find((c) => c.key === key);
        if (!country) {
          return res.status(404).json({
            ok: false,
            error: `Country '${key}' not found.`,
          });
        }

        const nextEnabled =
          typeof req.body?.enabled === 'boolean' ? req.body.enabled : !country.enabled;
        const requiredPerm: AdminPermission = nextEnabled
          ? 'countries.enable'
          : 'countries.disable';

        if (!ctx.permissions.has(requiredPerm)) {
          this.recordAuditEvent({
            eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            actor: ctx.user.username,
            actorRole: ctx.role,
            targetType: 'permission',
            targetKey: country.key,
            summary: `Denied '${ctx.user.username}' (${ctx.roleLabel}) attempt to ${nextEnabled ? 'enable' : 'disable'} country '${country.key}'.`,
            metadata: { requiredPermission: requiredPerm, role: ctx.role },
          });
          return res.status(403).json({
            ok: false,
            error: `Forbidden: Missing permission '${requiredPerm}'.`,
          });
        }

        country.enabled = nextEnabled;
        country.updatedAt = new Date().toISOString();
        this.saveState();

        this.recordAuditEvent({
          eventType: nextEnabled ? 'COUNTRY_ENABLED' : 'COUNTRY_DISABLED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'country',
          targetKey: country.key,
          summary: `${nextEnabled ? 'Enabled' : 'Disabled'} country '${country.name}' (${country.key}).`,
          metadata: {
            countryKey: country.key,
            enabled: country.enabled,
          },
        });

        return res.status(200).json({
          ok: true,
          country,
        });
      }
    );

    router.put(
      '/countries/:key/documents',
      requirePermission('country_documents.manage'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const key = normalizeCountryKey(req.params.key || '');
        const country = this.state.countries.find((c) => c.key === key);
        if (!country) {
          return res.status(404).json({
            ok: false,
            error: `Country '${key}' not found.`,
          });
        }

        if (!Array.isArray(req.body?.enabledDocs)) {
          return res.status(400).json({
            ok: false,
            error: 'enabledDocs array is required.',
          });
        }

        const rawDocList: unknown[] = req.body.enabledDocs;
        const nextDocs: DocTypeKey[] = Array.from(
          new Set<DocTypeKey>(
            rawDocList
              .map((d: unknown) => String(d).trim() as DocTypeKey)
              .filter((d: DocTypeKey) => VALID_DOC_TYPES.includes(d))
          )
        );

        country.enabledDocs = nextDocs;
        country.updatedAt = new Date().toISOString();
        this.saveState();

        this.recordAuditEvent({
          eventType: 'COUNTRY_DOCUMENTS_UPDATED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'country_documents',
          targetKey: country.key,
          summary: `Updated available documents for '${country.name}' (${country.key}): [${nextDocs.join(', ') || 'none'}].`,
          metadata: {
            countryKey: country.key,
            countryName: country.name,
            enabledDocs: nextDocs.join(','),
          },
        });

        return res.status(200).json({
          ok: true,
          country,
        });
      }
    );

    router.delete(
      '/countries/:key',
      requirePermission(['countries.update', 'countries.disable'], 'all'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const key = normalizeCountryKey(req.params.key || '');
        const idx = this.state.countries.findIndex((c) => c.key === key);
        if (idx === -1) {
          return res.status(404).json({
            ok: false,
            error: `Country '${key}' not found.`,
          });
        }

        const country = this.state.countries[idx];
        if (country.isBuiltIn) {
          return res.status(400).json({
            ok: false,
            error: `'${country.name}' is a core built-in KycApproved country with dedicated document templates. Disable it instead of deleting to preserve system integrity.`,
          });
        }

        this.state.countries.splice(idx, 1);
        this.saveState();

        this.recordAuditEvent({
          eventType: 'COUNTRY_REMOVED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'country',
          targetKey: country.key,
          summary: `Removed custom country '${country.name}' (${country.key}).`,
          metadata: {
            countryKey: country.key,
            name: country.name,
          },
        });

        return res.status(200).json({
          ok: true,
          removedKey: country.key,
        });
      }
    );

    // 2. DOCUMENT TYPES CRUD
    router.get(
      '/documents',
      requirePermission('documents.view'),
      (_req: Request, res: Response) => {
        const docsWithCounts = this.state.documents.map((doc) => {
          const assignedCountries = this.state.countries
            .filter((c) => c.enabledDocs.includes(doc.docType))
            .map((c) => c.key);
          return {
            ...doc,
            assignedCountryCount: assignedCountries.length,
            assignedCountries,
          };
        });

        return res.status(200).json({
          ok: true,
          documents: docsWithCounts,
        });
      }
    );

    router.put(
      '/documents/:docType',
      requirePermission('documents.update'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const docType = sanitizeText(req.params.docType, 32) as DocTypeKey;
        const doc = this.state.documents.find((d) => d.docType === docType);
        if (!doc) {
          return res.status(404).json({
            ok: false,
            error: `Document type '${docType}' not found.`,
          });
        }

        // Prevent price modification unless user holds payments.settings.manage
        if (
          req.body?.priceUsd !== undefined &&
          String(req.body.priceUsd).trim() !== doc.priceUsd
        ) {
          if (!ctx.permissions.has('payments.settings.manage')) {
            this.recordAuditEvent({
              eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
              actor: ctx.user.username,
              actorRole: ctx.role,
              targetType: 'permission',
              targetKey: doc.docType,
              summary: `Blocked '${ctx.user.username}' (${ctx.roleLabel}) attempt to change payment price for '${doc.docType}'.`,
              metadata: {
                docType: doc.docType,
                requiredPermission: 'payments.settings.manage',
              },
            });
            return res.status(403).json({
              ok: false,
              error: "Forbidden: Changing payment prices requires 'payments.settings.manage' permission.",
            });
          }
        }

        if (typeof req.body?.name === 'string' && req.body.name.trim()) {
          doc.name = sanitizeText(req.body.name, 80);
        }
        if (typeof req.body?.categoryLabel === 'string' && req.body.categoryLabel.trim()) {
          doc.categoryLabel = sanitizeText(req.body.categoryLabel, 120);
        }
        if (typeof req.body?.description === 'string' && req.body.description.trim()) {
          doc.description = sanitizeText(req.body.description, 220);
        }
        if (typeof req.body?.icon === 'string' && req.body.icon.trim()) {
          doc.icon = sanitizeText(req.body.icon, 60);
        }
        if (typeof req.body?.enabled === 'boolean') {
          const reqPerm: AdminPermission = req.body.enabled
            ? 'documents.enable'
            : 'documents.disable';
          if (!ctx.permissions.has(reqPerm)) {
            return res.status(403).json({
              ok: false,
              error: `Forbidden: Missing permission '${reqPerm}'.`,
            });
          }
          doc.enabled = req.body.enabled;
        }

        doc.updatedAt = new Date().toISOString();
        this.saveState();

        this.recordAuditEvent({
          eventType: 'DOCUMENT_UPDATED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'document',
          targetKey: doc.docType,
          summary: `Updated document metadata for '${doc.name}' (${doc.docType}).`,
          metadata: {
            docType: doc.docType,
            name: doc.name,
            enabled: doc.enabled,
          },
        });

        return res.status(200).json({
          ok: true,
          document: doc,
        });
      }
    );

    router.patch(
      '/documents/:docType/toggle',
      requirePermission(['documents.enable', 'documents.disable'], 'any'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const docType = sanitizeText(req.params.docType, 32) as DocTypeKey;
        const doc = this.state.documents.find((d) => d.docType === docType);
        if (!doc) {
          return res.status(404).json({
            ok: false,
            error: `Document type '${docType}' not found.`,
          });
        }

        const nextEnabled =
          typeof req.body?.enabled === 'boolean' ? req.body.enabled : !doc.enabled;
        const requiredPerm: AdminPermission = nextEnabled
          ? 'documents.enable'
          : 'documents.disable';

        if (!ctx.permissions.has(requiredPerm)) {
          this.recordAuditEvent({
            eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            actor: ctx.user.username,
            actorRole: ctx.role,
            targetType: 'permission',
            targetKey: doc.docType,
            summary: `Denied '${ctx.user.username}' (${ctx.roleLabel}) attempt to ${nextEnabled ? 'enable' : 'disable'} document '${doc.docType}'.`,
            metadata: { requiredPermission: requiredPerm, role: ctx.role },
          });
          return res.status(403).json({
            ok: false,
            error: `Forbidden: Missing permission '${requiredPerm}'.`,
          });
        }

        doc.enabled = nextEnabled;
        doc.updatedAt = new Date().toISOString();
        this.saveState();

        this.recordAuditEvent({
          eventType: nextEnabled ? 'DOCUMENT_ENABLED' : 'DOCUMENT_DISABLED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'document',
          targetKey: doc.docType,
          summary: `${nextEnabled ? 'Enabled' : 'Disabled'} document type '${doc.name}' (${doc.docType}).`,
          metadata: {
            docType: doc.docType,
            enabled: doc.enabled,
          },
        });

        return res.status(200).json({
          ok: true,
          document: doc,
        });
      }
    );

    // 3. ADMIN PREVIEW / TEST MODE (Server-Verified & Permission-Protected)
    router.get(
      '/test-mode/status',
      requirePermission('dashboard.view'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const canUseTestMode =
          ctx.permissions.has('png_test.use') || ctx.permissions.has('download_test.use');
        return res.status(200).json({
          ok: true,
          testModeEnabled: canUseTestMode && ctx.session.testModeEnabled,
          canUseTestMode,
          sessionId: ctx.session.sessionId,
          username: ctx.user.username,
          role: ctx.role,
        });
      }
    );

    router.post(
      '/test-mode/toggle',
      requirePermission(['png_test.use', 'download_test.use'], 'any'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const nextEnabled =
          typeof req.body?.enabled === 'boolean'
            ? req.body.enabled
            : !ctx.session.testModeEnabled;
        ctx.session.testModeEnabled = nextEnabled;

        if (!nextEnabled) {
          for (const record of this.testTokens.values()) {
            if (record.sessionId === ctx.session.sessionId && record.status === 'AUTHORIZED') {
              record.status = 'REVOKED';
            }
          }
        }

        this.recordAuditEvent({
          eventType: nextEnabled ? 'ADMIN_TEST_MODE_ENABLED' : 'ADMIN_TEST_MODE_DISABLED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'test_mode',
          targetKey: ctx.session.sessionId,
          summary: `Admin '${ctx.user.username}' (${ctx.roleLabel}) ${nextEnabled ? 'ENABLED' : 'DISABLED'} server-verified Admin Test Mode.`,
          metadata: {
            sessionId: ctx.session.sessionId,
            role: ctx.role,
            testModeEnabled: nextEnabled,
          },
        });

        return res.status(200).json({
          ok: true,
          testModeEnabled: ctx.session.testModeEnabled,
          sessionId: ctx.session.sessionId,
        });
      }
    );

    // Issues a short-lived, single-action admin test authorization token (never touches Sifalo payment state)
    router.post(
      '/test-mode/authorize-action',
      requirePermission(['png_test.use', 'download_test.use'], 'any'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const rawAction = sanitizeText(req.body?.action, 24);
        const action: 'save_png' | 'download' =
          rawAction === 'download' ? 'download' : 'save_png';
        const requiredActionPerm: AdminPermission =
          action === 'download' ? 'download_test.use' : 'png_test.use';

        if (!ctx.permissions.has(requiredActionPerm)) {
          this.recordAuditEvent({
            eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
            actor: ctx.user.username,
            actorRole: ctx.role,
            targetType: 'test_mode',
            targetKey: action,
            summary: `Denied '${ctx.user.username}' (${ctx.roleLabel}) Admin Test Mode action '${action}' — missing permission '${requiredActionPerm}'.`,
            metadata: {
              userId: ctx.user.userId,
              role: ctx.role,
              action,
              requiredPermission: requiredActionPerm,
            },
          });
          return res.status(403).json({
            ok: false,
            error: `Forbidden: Your role (${ctx.roleLabel}) does not have permission '${requiredActionPerm}'.`,
          });
        }

        if (!ctx.session.testModeEnabled) {
          return res.status(403).json({
            ok: false,
            error: 'Admin Test Mode is currently disabled on the server. Enable Admin Test Mode in the Admin Dashboard first.',
          });
        }

        const countryKey = normalizeCountryKey(sanitizeText(req.body?.countryKey, 48));
        const rawDocType = sanitizeText(req.body?.docType, 32) as DocTypeKey;

        if (!countryKey || !this.state.countries.some((c) => c.key === countryKey)) {
          return res.status(400).json({
            ok: false,
            error: `Invalid or unknown countryKey '${countryKey}'.`,
          });
        }

        const docType: DocTypeKey = VALID_DOC_TYPES.includes(rawDocType)
          ? rawDocType
          : 'passport';
        const expectedProductKey = DOC_TYPE_TO_PRODUCT_KEY[docType];
        const requestedProductKey = sanitizeText(
          req.body?.productKey,
          32
        ) as UnlockProductKey;
        const productKey: UnlockProductKey =
          requestedProductKey &&
          Object.values(DOC_TYPE_TO_PRODUCT_KEY).includes(requestedProductKey)
            ? requestedProductKey
            : expectedProductKey;

        const rawTestToken = `ADMINTEST-${crypto.randomUUID()}-${crypto.randomBytes(16).toString('hex')}`;
        const tokenHash = sha256Hex(rawTestToken);
        const nowMs = Date.now();
        const authorizationId = `ADM-AUTH-${crypto.randomUUID()}`;

        const record: AdminTestActionTokenRecord = {
          authorizationId,
          tokenHash,
          sessionId: ctx.session.sessionId,
          userId: ctx.user.userId,
          username: ctx.user.username,
          role: ctx.role,
          purpose: 'admin_test_only',
          countryKey,
          docType,
          productKey,
          action,
          status: 'AUTHORIZED',
          createdAtMs: nowMs,
          expiresAtMs: nowMs + ADMIN_TEST_TOKEN_TTL_MS,
          consumedAtMs: null,
        };

        this.testTokens.set(tokenHash, record);

        this.recordAuditEvent({
          eventType: action === 'download' ? 'ADMIN_TEST_DOWNLOAD' : 'ADMIN_TEST_SAVE_PNG',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'test_mode',
          targetKey: `${countryKey}:${docType}`,
          summary: `Admin '${ctx.user.username}' (${ctx.roleLabel}) authorized Admin Test Mode ${action === 'download' ? 'Download' : 'Save PNG'} for ${countryKey} (${docType}).`,
          metadata: {
            authorizationId,
            countryKey,
            docType,
            productKey,
            action,
            role: ctx.role,
            purpose: 'admin_test_only',
          },
        });

        return res.status(200).json({
          ok: true,
          authorized: true,
          purpose: 'admin_test_only',
          authorizationId,
          adminTestToken: rawTestToken,
          countryKey,
          docType,
          productKey,
          action,
          expiresAt: new Date(record.expiresAtMs).toISOString(),
        });
      }
    );

    // Atomically verifies & consumes the single-use admin test token
    router.post(
      '/test-mode/consume-token',
      requirePermission(['png_test.use', 'download_test.use'], 'any'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;

        if (!ctx.session.testModeEnabled) {
          return res.status(403).json({
            ok: false,
            consumed: false,
            error: 'Admin Test Mode is not enabled for this admin session.',
          });
        }

        const rawToken = sanitizeText(req.body?.adminTestToken, 200);
        const countryKey = normalizeCountryKey(sanitizeText(req.body?.countryKey, 48));
        const productKey = sanitizeText(req.body?.productKey, 32);
        const rawAction = sanitizeText(req.body?.action, 24);
        const action: 'save_png' | 'download' =
          rawAction === 'download' ? 'download' : 'save_png';
        const requiredActionPerm: AdminPermission =
          action === 'download' ? 'download_test.use' : 'png_test.use';

        if (!ctx.permissions.has(requiredActionPerm)) {
          return res.status(403).json({
            ok: false,
            consumed: false,
            error: `Forbidden: Missing permission '${requiredActionPerm}'.`,
          });
        }

        if (!rawToken || !rawToken.startsWith('ADMINTEST-')) {
          return res.status(401).json({
            ok: false,
            consumed: false,
            error: 'Invalid admin test authorization token.',
          });
        }

        const tokenHash = sha256Hex(rawToken);
        const record = this.testTokens.get(tokenHash);
        if (!record) {
          return res.status(401).json({
            ok: false,
            consumed: false,
            error: 'Admin test authorization token not found.',
          });
        }

        if (record.sessionId !== ctx.session.sessionId || record.userId !== ctx.user.userId) {
          return res.status(403).json({
            ok: false,
            consumed: false,
            error: 'Admin test token does not belong to the active admin session.',
          });
        }

        const nowMs = Date.now();
        if (record.status === 'CONSUMED') {
          return res.status(409).json({
            ok: false,
            consumed: false,
            error: 'Admin test token has already been consumed (single-use only).',
          });
        }

        if (record.status === 'REVOKED' || nowMs >= record.expiresAtMs) {
          record.status = nowMs >= record.expiresAtMs ? 'EXPIRED' : record.status;
          return res.status(401).json({
            ok: false,
            consumed: false,
            error: 'Admin test token has expired or been revoked.',
          });
        }

        if (countryKey && record.countryKey !== countryKey) {
          return res.status(403).json({
            ok: false,
            consumed: false,
            error: 'Admin test token country mismatch.',
          });
        }

        if (productKey && record.productKey !== productKey) {
          return res.status(403).json({
            ok: false,
            consumed: false,
            error: 'Admin test token product mismatch.',
          });
        }

        if (record.action !== action) {
          return res.status(403).json({
            ok: false,
            consumed: false,
            error: 'Admin test token action mismatch.',
          });
        }

        record.status = 'CONSUMED';
        record.consumedAtMs = nowMs;

        return res.status(200).json({
          ok: true,
          consumed: true,
          purpose: 'admin_test_only',
          authorizationId: record.authorizationId,
          countryKey: record.countryKey,
          docType: record.docType,
          productKey: record.productKey,
          action: record.action,
          consumedAt: new Date(nowMs).toISOString(),
        });
      }
    );

    // 4. ADMIN USER & ROLE MANAGEMENT (Super Admin Protected)
    router.get(
      '/users',
      requirePermission('admins.view'),
      (_req: Request, res: Response) => {
        this.syncBootstrapSuperAdminAccount();
        const users = this.state.adminUsers.map((u) => toPublicAdminUser(u));
        return res.status(200).json({
          ok: true,
          users,
          activeSuperAdminCount: this.countActiveSuperAdmins(),
        });
      }
    );

    router.post(
      '/users',
      requirePermission(['admins.create', 'roles.manage'], 'all'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const username = normalizeUsername(sanitizeText(req.body?.username, 64));
        const displayName = sanitizeText(req.body?.displayName, 80) || username;
        const rawRole = sanitizeText(req.body?.role, 32) as AdminRole;
        const role: AdminRole = ALL_ADMIN_ROLES.includes(rawRole) ? rawRole : 'viewer';
        const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
        const enabled = req.body?.enabled !== false;

        if (!username || username.length < 3) {
          return res.status(400).json({
            ok: false,
            error: 'Admin username must be at least 3 alphanumeric characters.',
          });
        }

        if (password.length < 8) {
          return res.status(400).json({
            ok: false,
            error: 'Admin password must be at least 8 characters long.',
          });
        }

        this.syncBootstrapSuperAdminAccount();
        if (
          this.state.adminUsers.some(
            (u) => u.username.toLowerCase() === username.toLowerCase()
          )
        ) {
          return res.status(409).json({
            ok: false,
            error: `An admin account with username '${username}' already exists.`,
          });
        }

        let customPermissions: AdminPermission[] | null = null;
        if (Array.isArray(req.body?.customPermissions)) {
          customPermissions = Array.from(
            new Set<AdminPermission>(
              req.body.customPermissions.filter((p: unknown): p is AdminPermission =>
                ALL_ADMIN_PERMISSIONS.includes(p as AdminPermission)
              )
            )
          );
        }

        const saltHex = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPasswordScrypt(password, saltHex);
        const nowIso = new Date().toISOString();

        const newUser: AdminUserRecord = {
          userId: `ADMUSER-${crypto.randomUUID()}`,
          username,
          displayName,
          role,
          customPermissions,
          passwordSalt: saltHex,
          passwordHash,
          enabled,
          isEnvBootstrap: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          lastLoginAt: null,
          createdBy: ctx.user.username,
        };

        this.state.adminUsers.push(newUser);
        this.saveState();

        this.recordAuditEvent({
          eventType: 'ADMIN_USER_CREATED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'admin_user',
          targetKey: newUser.username,
          summary: `Created admin user '${newUser.username}' with role '${ADMIN_ROLE_LABELS[newUser.role]}'.`,
          metadata: {
            targetUserId: newUser.userId,
            targetUsername: newUser.username,
            assignedRole: newUser.role,
            enabled: newUser.enabled,
          },
        });

        return res.status(201).json({
          ok: true,
          user: toPublicAdminUser(newUser),
        });
      }
    );

    // Update Admin User Role / Permissions / Display Name
    router.put(
      '/users/:userId',
      requirePermission('admins.update'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const userId = sanitizeText(req.params.userId, 80);
        this.syncBootstrapSuperAdminAccount();

        const targetUser = this.state.adminUsers.find((u) => u.userId === userId);
        if (!targetUser) {
          return res.status(404).json({
            ok: false,
            error: `Admin user '${userId}' not found.`,
          });
        }

        // Role change check
        if (req.body?.role !== undefined && req.body.role !== targetUser.role) {
          if (!ctx.permissions.has('roles.manage')) {
            this.recordAuditEvent({
              eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
              actor: ctx.user.username,
              actorRole: ctx.role,
              targetType: 'permission',
              targetKey: targetUser.username,
              summary: `Denied '${ctx.user.username}' attempt to change role for '${targetUser.username}'.`,
              metadata: { requiredPermission: 'roles.manage' },
            });
            return res.status(403).json({
              ok: false,
              error: "Forbidden: Changing admin roles requires 'roles.manage' permission.",
            });
          }

          const nextRole = sanitizeText(req.body.role, 32) as AdminRole;
          if (!ALL_ADMIN_ROLES.includes(nextRole)) {
            return res.status(400).json({
              ok: false,
              error: `Invalid role '${nextRole}'.`,
            });
          }

          // Safety check: do not allow demoting the last active Super Admin
          if (
            targetUser.role === 'super_admin' &&
            nextRole !== 'super_admin' &&
            targetUser.enabled &&
            this.countActiveSuperAdmins() <= 1
          ) {
            return res.status(400).json({
              ok: false,
              error: 'Safety Check Blocked: Cannot remove Super Admin role from the last active Super Admin account.',
            });
          }

          const prevRole = targetUser.role;
          targetUser.role = nextRole;
          targetUser.customPermissions = null; // Reset custom overrides on role switch unless explicitly provided

          // Update any active sessions for this user
          for (const sess of this.sessions.values()) {
            if (sess.userId === targetUser.userId) {
              sess.role = nextRole;
            }
          }
          this.revokeTestTokensForUser(targetUser.userId);

          this.recordAuditEvent({
            eventType: 'ADMIN_ROLE_CHANGED',
            actor: ctx.user.username,
            actorRole: ctx.role,
            targetType: 'admin_user',
            targetKey: targetUser.username,
            summary: `Changed role for '${targetUser.username}' from '${ADMIN_ROLE_LABELS[prevRole]}' to '${ADMIN_ROLE_LABELS[nextRole]}'.`,
            metadata: {
              targetUserId: targetUser.userId,
              targetUsername: targetUser.username,
              previousRole: prevRole,
              newRole: nextRole,
            },
          });
        }

        // Custom permissions update check
        if (req.body?.customPermissions !== undefined) {
          if (!ctx.permissions.has('roles.manage')) {
            return res.status(403).json({
              ok: false,
              error: "Forbidden: Changing permissions requires 'roles.manage' permission.",
            });
          }

          if (req.body.customPermissions === null) {
            targetUser.customPermissions = null;
          } else if (Array.isArray(req.body.customPermissions)) {
            const nextPerms = Array.from(
              new Set<AdminPermission>(
                req.body.customPermissions.filter((p: unknown): p is AdminPermission =>
                  ALL_ADMIN_PERMISSIONS.includes(p as AdminPermission)
                )
              )
            );

            // Safety check: if targetUser is the last active Super Admin, ensure they retain core super admin management permissions
            if (
              targetUser.role === 'super_admin' &&
              targetUser.enabled &&
              this.countActiveSuperAdmins() <= 1
            ) {
              const criticalPerms: AdminPermission[] = [
                'dashboard.view',
                'admins.view',
                'admins.update',
                'admins.disable',
                'roles.manage',
              ];
              const missingCritical = criticalPerms.filter((p) => !nextPerms.includes(p));
              if (missingCritical.length > 0) {
                return res.status(400).json({
                  ok: false,
                  error: `Safety Check Blocked: Cannot strip critical Super Admin permissions (${missingCritical.join(', ')}) from the last active Super Admin.`,
                });
              }
            }

            targetUser.customPermissions = nextPerms;
          }

          this.revokeTestTokensForUser(targetUser.userId);

          this.recordAuditEvent({
            eventType: 'ADMIN_PERMISSIONS_CHANGED',
            actor: ctx.user.username,
            actorRole: ctx.role,
            targetType: 'admin_user',
            targetKey: targetUser.username,
            summary: `Updated permissions for '${targetUser.username}' (${ADMIN_ROLE_LABELS[targetUser.role]}).`,
            metadata: {
              targetUserId: targetUser.userId,
              targetUsername: targetUser.username,
              role: targetUser.role,
              customPermissionsCount: targetUser.customPermissions
                ? targetUser.customPermissions.length
                : -1,
            },
          });
        }

        if (typeof req.body?.displayName === 'string' && req.body.displayName.trim()) {
          targetUser.displayName = sanitizeText(req.body.displayName, 80);
        }

        targetUser.updatedAt = new Date().toISOString();
        this.saveState();

        return res.status(200).json({
          ok: true,
          user: toPublicAdminUser(targetUser),
        });
      }
    );

    // Enable / Disable Admin Account
    router.patch(
      '/users/:userId/status',
      requirePermission('admins.disable'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const userId = sanitizeText(req.params.userId, 80);
        this.syncBootstrapSuperAdminAccount();

        const targetUser = this.state.adminUsers.find((u) => u.userId === userId);
        if (!targetUser) {
          return res.status(404).json({
            ok: false,
            error: `Admin user '${userId}' not found.`,
          });
        }

        const nextEnabled =
          typeof req.body?.enabled === 'boolean' ? req.body.enabled : !targetUser.enabled;

        if (!nextEnabled && targetUser.role === 'super_admin' && targetUser.enabled) {
          if (this.countActiveSuperAdmins() <= 1) {
            return res.status(400).json({
              ok: false,
              error: 'Safety Check Blocked: Cannot disable the last active Super Admin account.',
            });
          }
          if (targetUser.userId === ctx.user.userId) {
            return res.status(400).json({
              ok: false,
              error: 'Safety Check Blocked: You cannot disable your own active Super Admin account while signed in.',
            });
          }
        }

        targetUser.enabled = nextEnabled;
        targetUser.updatedAt = new Date().toISOString();
        this.saveState();

        if (!nextEnabled) {
          this.revokeSessionsAndTokensForUser(targetUser.userId);
        }

        this.recordAuditEvent({
          eventType: nextEnabled ? 'ADMIN_USER_ENABLED' : 'ADMIN_USER_DISABLED',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'admin_user',
          targetKey: targetUser.username,
          summary: `${nextEnabled ? 'Enabled' : 'Disabled'} admin account '${targetUser.username}' (${ADMIN_ROLE_LABELS[targetUser.role]}).`,
          metadata: {
            targetUserId: targetUser.userId,
            targetUsername: targetUser.username,
            role: targetUser.role,
            enabled: nextEnabled,
          },
        });

        return res.status(200).json({
          ok: true,
          user: toPublicAdminUser(targetUser),
        });
      }
    );

    // Secure Admin Password Reset (Super Admin only)
    router.post(
      '/users/:userId/reset-password',
      requirePermission('admins.update'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const userId = sanitizeText(req.params.userId, 80);
        const newPassword =
          typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';

        if (newPassword.length < 8) {
          return res.status(400).json({
            ok: false,
            error: 'New password must be at least 8 characters long.',
          });
        }

        const targetUser = this.state.adminUsers.find((u) => u.userId === userId);
        if (!targetUser) {
          return res.status(404).json({
            ok: false,
            error: `Admin user '${userId}' not found.`,
          });
        }

        const saltHex = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPasswordScrypt(newPassword, saltHex);
        targetUser.passwordSalt = saltHex;
        targetUser.passwordHash = passwordHash;
        targetUser.updatedAt = new Date().toISOString();
        this.saveState();

        // Invalidate existing sessions for the target user if resetting another user's password
        if (targetUser.userId !== ctx.user.userId) {
          this.revokeSessionsAndTokensForUser(targetUser.userId);
        }

        this.recordAuditEvent({
          eventType: 'ADMIN_PASSWORD_RESET',
          actor: ctx.user.username,
          actorRole: ctx.role,
          targetType: 'admin_user',
          targetKey: targetUser.username,
          summary: `Reset password for admin account '${targetUser.username}'.`,
          metadata: {
            targetUserId: targetUser.userId,
            targetUsername: targetUser.username,
          },
        });

        return res.status(200).json({
          ok: true,
          message: `Password reset for '${targetUser.username}'.`,
        });
      }
    );

    // 5. ADMIN AUDIT LOGS
    router.get(
      '/audit-logs',
      requirePermission('audit.view'),
      (req: Request, res: Response) => {
        const ctx = (req as Request & { adminContext: AuthenticatedAdminContext }).adminContext;
        const eventTypeFilter = sanitizeText(req.query.eventType, 48).toUpperCase();
        const targetTypeFilter = sanitizeText(req.query.targetType, 32).toLowerCase();
        const search = sanitizeText(req.query.search, 80).toLowerCase();

        let logs = this.getAuditLogsForContext(ctx);
        if (eventTypeFilter) {
          logs = logs.filter((l) => l.eventType === eventTypeFilter);
        }
        if (targetTypeFilter) {
          logs = logs.filter((l) => l.targetType === targetTypeFilter);
        }
        if (search) {
          logs = logs.filter(
            (l) =>
              l.summary.toLowerCase().includes(search) ||
              l.eventType.toLowerCase().includes(search) ||
              (l.targetKey && l.targetKey.toLowerCase().includes(search)) ||
              l.actor.toLowerCase().includes(search)
          );
        }

        return res.status(200).json({
          ok: true,
          total: logs.length,
          auditLogs: logs.slice(0, 200),
        });
      }
    );

    return router;
  }
}
