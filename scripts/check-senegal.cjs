#!/usr/bin/env node
/**
 * Senegal (République du Sénégal — passeport biométrique CEDEAO) regression check.
 * Guards:
 *  - the reference specimen data shown on the CEDEAO endorsement page + data page
 *  - the reference-matched design classes (.sen-pp-*) and cropped portrait assets
 *  - the data-sen / data-mrz contract with updateSenPreview() + updateSenMRZ()
 *  - unique element ids (the markup replacement must not collide)
 *  - the absence of the previous ECOWAS identity-card design
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = ['index.html'].filter((f) => fs.existsSync(path.join(root, f)));
const errors = [];
const warn = [];

function fail(msg) {
  errors.push(msg);
}

// ---- 1. Required container IDs -------------------------------------------
const containerIds = [
  'senegal-passport-view',
  'sen-view-spread',
  'sen-view-datapage',
  'sen-view-page1',
  'sen-tab-spread',
  'sen-tab-datapage',
  'sen-tab-page1',
  'senegal-passport-spread',
  'senegal-spread-page1',
  'senegal-spread-datapage',
  'senegal-datapage-card',
  'senegal-page1-card',
  'senPassDocForm',
  'senMrzLegacy',
  'senMrzLine1',
  'senMrzLine2',
  'senSingleMrzLine1',
  'senSingleMrzLine2',
  'senPassPhotoInput',
  'senPassInputType',
  'senPassInputCountryCode',
  'senPassInputSurname',
  'senPassInputGiven',
  'senPassInputNationality',
  'senPassInputSex',
  'senPassInputDob',
  'senPassInputPob',
  'senPassInputPassNo',
  'senPassInputPersonalNo',
  'senPassInputAuthority',
  'senPassInputIssueDate',
  'senPassInputExpiryDate',
  'senPassInputSignature',
];

// ---- 2. Exact reference specimen values / design strings ------------------
const referenceValues = [
  'RÉPUBLIQUE DU SÉNÉGAL',
  'CEDEAO',
  'PASSEPORT BIOMÉTRIQUE',
  'KASSE',
  'DIEYNABA',
  'A04163606',
  'A 04163606',
  '2312201200531',
  '25 NOV / NOV 2001',
  'DOUMGA LAO',
  'MINT/DGPN/DPETV',
  '19 OCT / OCT 2024',
  '18 OCT / OCT 2029',
  'SENEGALAISE',
  'Ce passeport contient 32 pages',
  'senegal_passport_portrait.jpg',
  'senegal_passport_ghost.jpg',
  'sen-pp-spread',
  'sen-pp-page',
  'sen-pp-data-grid',
  'sen-pp-mrz',
];

// Static MRZ (ICAO TD-3, 44 characters per line) rendered before JS runs.
const REFERENCE_MRZ_1_HEAD = 'P<SENKASSE<<DIEYNABA';
const REFERENCE_MRZ_1 = REFERENCE_MRZ_1_HEAD + '<'.repeat(44 - REFERENCE_MRZ_1_HEAD.length);
const REFERENCE_MRZ_2_PREFIX = 'A041636060SEN0111252F2910183';

files.forEach((file) => {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const out = (msg) => fail(`${file}: ${msg}`);

  containerIds.forEach((id) => {
    if (!html.includes(`id="${id}"`)) out(`missing container id "${id}"`);
  });

  referenceValues.forEach((val) => {
    if (!html.includes(val)) out(`missing reference value "${val}"`);
  });

  // ---- 3. No duplicate id attributes -------------------------------------
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  const dupes = new Set();
  ids.forEach((id) => (seen.has(id) ? dupes.add(id) : seen.add(id)));
  if (dupes.size) out(`duplicate ids: ${[...dupes].join(', ')}`);

  // ---- 4. data-sen contract with updateSenPreview() ----------------------
  const keysInMarkup = new Set([...html.matchAll(/data-sen="([a-z]+)"/g)].map((m) => m[1]));
  const keysSetByJs = new Set([...html.matchAll(/setField\('([a-z]+)'/g)].map((m) => m[1]));
  keysSetByJs.forEach((k) => {
    if (!keysInMarkup.has(k)) out(`setField('${k}') has no data-sen target`);
  });
  keysInMarkup.forEach((k) => {
    if (!keysSetByJs.has(k)) warn.push(`${file}: data-sen="${k}" never updated`);
  });
  const expectedKeys = [
    'type', 'ccode', 'passno', 'pageno', 'personal', 'surname', 'given',
    'nationality', 'sex', 'dob', 'pob', 'authority', 'issue', 'expiry', 'signature',
  ];
  expectedKeys.forEach((k) => {
    if (!keysInMarkup.has(k)) out(`missing data-sen="${k}" in markup`);
    if (!keysSetByJs.has(k)) out(`missing setField('${k}') in updateSenPreview()`);
  });

  // ---- 5. MRZ targets wired by updateSenMRZ() ----------------------------
  if (!/\[data-mrz="1"\]/.test(html)) out('updateSenMRZ() does not write [data-mrz="1"]');
  if (!/\[data-mrz="2"\]/.test(html)) out('updateSenMRZ() does not write [data-mrz="2"]');
  if (!/function mrzCheckDigit\(/.test(html)) out('missing ICAO 9303 check-digit helper');

  const mrzCells = [...html.matchAll(/<div data-mrz="(\d)">([^<]*)<\/div>/g)].map((m) => ({
    n: m[1],
    text: m[2]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  }));
  if (mrzCells.length < 4) {
    out(`expected 4 static MRZ cells (2 views x 2 lines), found ${mrzCells.length}`);
  }
  mrzCells.forEach((cell) => {
    if (cell.text.length !== 44) {
      out(`MRZ line ${cell.n} is ${cell.text.length} chars, expected 44 ("${cell.text}")`);
    }
    if (!/^[A-Z0-9<]+$/.test(cell.text)) out(`MRZ line ${cell.n} has invalid characters`);
  });
  const line1 = mrzCells.find((c) => c.n === '1');
  const line2 = mrzCells.find((c) => c.n === '2');
  if (line1 && line1.text !== REFERENCE_MRZ_1) {
    out(`MRZ line 1 mismatch: "${line1.text}" (expected "${REFERENCE_MRZ_1}")`);
  }
  if (line2 && !line2.text.startsWith(REFERENCE_MRZ_2_PREFIX)) {
    out(`MRZ line 2 mismatch: "${line2.text}" (expected prefix "${REFERENCE_MRZ_2_PREFIX}")`);
  }

  // ---- 6. Previous ECOWAS ID-card design must be gone --------------------
  if (/sen-eco-/.test(html)) out('stale .sen-eco-* identity-card design still present');
  ['senPassInputHeight', 'senPassInputAddress', 'senegal_id_portrait.jpg'].forEach((stale) => {
    if (html.includes(stale)) out(`stale identity-card reference "${stale}" still present`);
  });

  // ---- 7. Passport portrait asset must be referenced ---------------------
  const portraitRefs = [...html.matchAll(/assets\/aistudio\/(senegal_passport_portrait\.jpg)/g)];
  if (portraitRefs.length < 3) {
    out(`passport portrait referenced only ${portraitRefs.length}x (expected 3+)`);
  }
});

// ---- 8. Cropped assets must exist --------------------------------------
[
  'senegal_passport_portrait.jpg',
  'senegal_passport_ghost.jpg',
].forEach((name) => {
  const p = path.join(root, 'public', 'assets', 'aistudio', name);
  if (!fs.existsSync(p)) fail(`missing asset public/assets/aistudio/${name}`);
});

warn.forEach((w) => console.log(` - warn: ${w}`));

if (errors.length) {
  console.error('Senegal regression check FAILED:');
  errors.forEach((e) => console.error(` - ${e}`));
  process.exit(1);
}

console.log(
  `Senegal regression check passed for: ${files.join(', ')}\n` +
    ' - container IDs and view-mode tabs preserved, no duplicate ids\n' +
    ' - reference specimen data present (CEDEAO page 1 + biometric data page)\n' +
    ' - 44-char TD3 MRZ lines match the reference specimen\n' +
    ' - data-sen / setField() / data-mrz contracts in sync\n' +
    ' - passport portrait assets present and referenced'
);
